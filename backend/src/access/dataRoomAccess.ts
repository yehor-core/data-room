import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../errors';
import { Logger } from '../lib/logger';
import { FileStorage } from '../ports';
import { buildBreadcrumb, subtreeIds, type Crumb, type FolderNode } from './folderTree';
import { checkUpload } from './uploads';

const VIEW_LINK_TTL_SECONDS = 60;

const dataRoomCounts = {
  _count: { select: { folders: true, files: true } },
} satisfies Prisma.DataRoomInclude;
const folderCounts = {
  _count: { select: { children: true, files: true } },
} satisfies Prisma.FolderInclude;

const conflicts = {
  dataRoom: 'A data room with this name already exists',
  folder: 'A folder with this name already exists in this location',
  file: 'A file with this name already exists in this location',
};

export interface AccessDependencies {
  db: PrismaClient;
  storage: FileStorage;
  logger: Logger;
}

export interface UploadInput {
  dataRoomId: string;
  folderId?: string;
  name: string;
  mimeType: string;
  content: Buffer;
}

/**
 * Everything a user can do with data rooms, folders and files. Owns the access rules:
 * a resource is the user's if its data room is; anything else is reported exactly like
 * a resource that does not exist. Names are unique among siblings (enforced by unique
 * indexes, so concurrent requests can't slip past). Deleting removes stored content too.
 */
export function createDataRoomAccess({ db, storage, logger }: AccessDependencies, userId: string) {
  const notFound = (what: string) => new AppError('NOT_FOUND', `${what} not found`);

  const rethrowDuplicateAs = (message: string) => (error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('CONFLICT', message);
    }
    throw error;
  };

  async function ownedDataRoom(id: string) {
    const dataRoom = await db.dataRoom.findFirst({
      where: { id, ownerId: userId },
      select: { id: true, name: true },
    });
    if (!dataRoom) throw notFound('Data room');
    return dataRoom;
  }

  async function ownedFolder(id: string) {
    const folder = await db.folder.findFirst({ where: { id, dataRoom: { ownerId: userId } } });
    if (!folder) throw notFound('Folder');
    return folder;
  }

  async function ownedFile(id: string) {
    const file = await db.file.findFirst({ where: { id, dataRoom: { ownerId: userId } } });
    if (!file) throw notFound('File');
    return file;
  }

  /** Checks that the folder exists in this (already owned) data room. */
  async function assertFolderInDataRoom(dataRoomId: string, folderId: string) {
    const folder = await db.folder.findFirst({
      where: { id: folderId, dataRoomId },
      select: { id: true },
    });
    if (!folder) throw notFound('Folder');
  }

  /** Storage failures are logged, never undone: the records are already gone. */
  async function removeStored(paths: (string | null)[]) {
    const existing = paths.filter((path): path is string => path !== null);
    if (existing.length === 0) return;
    try {
      await storage.remove(existing);
    } catch (error) {
      logger.error(`Failed to remove ${existing.length} stored file(s)`, error);
    }
  }

  return {
    dataRooms: {
      list: () =>
        db.dataRoom.findMany({
          where: { ownerId: userId },
          include: dataRoomCounts,
          orderBy: { createdAt: 'desc' },
        }),

      create: (name: string) =>
        db.dataRoom
          .create({ data: { name, ownerId: userId }, include: dataRoomCounts })
          .catch(rethrowDuplicateAs(conflicts.dataRoom)),

      async delete(id: string) {
        await ownedDataRoom(id);
        const paths = await db.$transaction(async (tx) => {
          const files = await tx.file.findMany({
            where: { dataRoomId: id },
            select: { filePath: true },
          });
          await tx.dataRoom.delete({ where: { id } });
          return files.map((file) => file.filePath);
        });
        await removeStored(paths);
      },
    },

    folders: {
      async create({
        dataRoomId,
        parentId,
        name,
      }: {
        dataRoomId: string;
        parentId?: string;
        name: string;
      }) {
        await ownedDataRoom(dataRoomId);
        if (parentId) await assertFolderInDataRoom(dataRoomId, parentId);
        return db.folder
          .create({
            data: { name, dataRoomId, parentId: parentId ?? null, userId },
            include: folderCounts,
          })
          .catch(rethrowDuplicateAs(conflicts.folder));
      },

      async rename(id: string, name: string) {
        await ownedFolder(id);
        return db.folder
          .update({ where: { id }, data: { name }, include: folderCounts })
          .catch(rethrowDuplicateAs(conflicts.folder));
      },

      async delete(id: string) {
        const folder = await ownedFolder(id);
        const paths = await db.$transaction(async (tx) => {
          const roomFolders = await tx.folder.findMany({
            where: { dataRoomId: folder.dataRoomId },
            select: { id: true, parentId: true },
          });
          const files = await tx.file.findMany({
            where: { folderId: { in: subtreeIds(roomFolders, id) } },
            select: { filePath: true },
          });
          await tx.folder.delete({ where: { id } });
          return files.map((file) => file.filePath);
        });
        await removeStored(paths);
      },
    },

    files: {
      async upload({ dataRoomId, folderId, name, mimeType, content }: UploadInput) {
        await ownedDataRoom(dataRoomId);
        if (folderId) await assertFolderInDataRoom(dataRoomId, folderId);
        checkUpload({ mimeType, content });
        // Checked up front so a duplicate isn't uploaded only to be removed again; the index still decides races.
        const clash = await db.file.findFirst({
          where: { dataRoomId, folderId: folderId ?? null, name },
        });
        if (clash) throw new AppError('CONFLICT', conflicts.file);

        const filePath = await storage.put({ name, content, contentType: mimeType });
        try {
          return await db.file.create({
            data: {
              name,
              dataRoomId,
              folderId: folderId ?? null,
              userId,
              fileSize: content.length,
              mimeType,
              filePath,
            },
          });
        } catch (error) {
          await removeStored([filePath]);
          return rethrowDuplicateAs(conflicts.file)(error);
        }
      },

      async rename(id: string, name: string) {
        await ownedFile(id);
        return db.file
          .update({ where: { id }, data: { name } })
          .catch(rethrowDuplicateAs(conflicts.file));
      },

      async delete(id: string) {
        const file = await ownedFile(id);
        await db.file.delete({ where: { id } });
        await removeStored([file.filePath]);
      },

      /** A short-lived signed link to the file's content. */
      async viewLink(id: string) {
        const { filePath } = await ownedFile(id);
        if (!filePath) throw notFound('File content');
        return { url: await storage.signedUrl(filePath, VIEW_LINK_TTL_SECONDS) };
      },
    },

    /** One level of a data room: its root when `folderId` is absent, otherwise that folder. */
    async contents(dataRoomId: string, folderId?: string) {
      const dataRoom = await ownedDataRoom(dataRoomId);
      let folder: FolderNode | null = null;
      let breadcrumb: Crumb[] = [];
      if (folderId) {
        const roomFolders = await db.folder.findMany({
          where: { dataRoomId },
          select: { id: true, name: true, parentId: true },
        });
        folder = roomFolders.find((candidate) => candidate.id === folderId) ?? null;
        if (!folder) throw notFound('Folder');
        breadcrumb = buildBreadcrumb(roomFolders, folderId);
      }

      const level = folderId ?? null;
      const [folders, files] = await Promise.all([
        db.folder.findMany({
          where: { dataRoomId, parentId: level },
          include: folderCounts,
          orderBy: { name: 'asc' },
        }),
        db.file.findMany({ where: { dataRoomId, folderId: level }, orderBy: { name: 'asc' } }),
      ]);
      return { dataRoom, folder, breadcrumb, folders, files };
    },
  };
}

export type DataRoomAccess = ReturnType<typeof createDataRoomAccess>;

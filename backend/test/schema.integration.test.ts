import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createEmptyDatabase, migrateDeploy, migrateDeployUpTo, runPrisma, schemaPath } from './db';

const serverUrl = () => process.env.DATABASE_URL!;

const uniqueViolation = { code: 'P2002' };

describe('migrations', () => {
  it('apply to an empty database', async () => {
    const url = await createEmptyDatabase(serverUrl(), 'migrations_from_empty');

    await migrateDeploy(url);

    const prisma = new PrismaClient({ datasourceUrl: url });
    try {
      const owner = await prisma.user.create({ data: { email: 'owner@example.com' } });
      const room = await prisma.dataRoom.create({ data: { name: 'Deal', ownerId: owner.id } });
      expect(room.name).toBe('Deal');
    } finally {
      await prisma.$disconnect();
    }
  });

  it('produce exactly the schema in schema.prisma', async () => {
    const shadow = await createEmptyDatabase(serverUrl(), 'migrations_shadow');

    const { stdout } = await runPrisma(
      ['migrate', 'diff', '--from-migrations', 'prisma/migrations', '--to-schema-datamodel', schemaPath,
        '--shadow-database-url', shadow, '--script'],
      shadow,
    );

    const statements = stdout.split('\n').filter((line) => line.trim() && !line.startsWith('--'));
    expect(statements).toEqual([]);
  });

  describe('on a database deployed at the baseline', () => {
    const seed = async (url: string, statements: string[]) => {
      const prisma = new PrismaClient({ datasourceUrl: url });
      try {
        for (const sql of statements) await prisma.$executeRawUnsafe(sql);
      } finally {
        await prisma.$disconnect();
      }
    };

    it('stop and report every duplicate name, including at the root level', async () => {
      const url = await createEmptyDatabase(serverUrl(), 'migrations_with_duplicates');
      await migrateDeployUpTo(url, '0_init');
      await seed(url, [
        `INSERT INTO users (id, email, updated_at) VALUES ('u1', 'u1@example.com', now())`,
        `INSERT INTO data_rooms (id, name, user_id, updated_at) VALUES ('r1', 'Deal', 'u1', now()), ('r2', 'Deal', 'u1', now())`,
        `INSERT INTO folders (id, name, data_room_id, parent_folder_id, user_id, updated_at) VALUES
           ('f1', 'Legal', 'r1', NULL, 'u1', now()), ('f2', 'Legal', 'r1', NULL, 'u1', now()),
           ('f3', 'Contracts', 'r1', 'f1', 'u1', now()), ('f4', 'Contracts', 'r1', 'f1', 'u1', now()),
           ('f5', 'Contracts', 'r1', 'f2', 'u1', now())`,
        `INSERT INTO files (id, name, data_room_id, folder_id, user_id, updated_at) VALUES
           ('d1', 'nda.pdf', 'r1', NULL, 'u1', now()), ('d2', 'nda.pdf', 'r1', NULL, 'u1', now()),
           ('d3', 'nda.pdf', 'r1', 'f3', 'u1', now()), ('d4', 'nda.pdf', 'r1', 'f3', 'u1', now()),
           ('d5', 'nda.pdf', 'r1', 'f4', 'u1', now())`,
      ]);

      const failure = await migrateDeploy(url).then(
        () => 'migrations applied',
        (error: { stdout: string; stderr: string }) => error.stdout + error.stderr,
      );

      expect(failure).toContain(`data room name "Deal" is used 2 times by user u1`);
      expect(failure).toContain(`folder name "Legal" is used 2 times in data room r1 at the root`);
      expect(failure).toContain(`folder name "Contracts" is used 2 times in data room r1 in folder f1`);
      expect(failure).toContain(`file name "nda.pdf" is used 2 times in data room r1 at the root`);
      expect(failure).toContain(`file name "nda.pdf" is used 2 times in data room r1 in folder f3`);
      expect(failure).not.toContain('in folder f2');
      expect(failure).not.toContain('in folder f4');
    });

    it('apply once the duplicates are resolved and the failed migration is marked rolled back', async () => {
      const url = await createEmptyDatabase(serverUrl(), 'migrations_after_duplicates');
      await migrateDeployUpTo(url, '0_init');
      await seed(url, [
        `INSERT INTO users (id, email, updated_at) VALUES ('u1', 'u1@example.com', now())`,
        `INSERT INTO data_rooms (id, name, user_id, updated_at) VALUES ('r1', 'Deal', 'u1', now()), ('r2', 'Deal', 'u1', now())`,
      ]);
      await expect(migrateDeploy(url)).rejects.toThrow();

      await seed(url, [`UPDATE data_rooms SET name = 'Deal 2' WHERE id = 'r2'`]);
      await runPrisma(['migrate', 'resolve', '--rolled-back', '20261119120000_unique_names'], url);

      await expect(migrateDeploy(url)).resolves.toBeDefined();
    });

    it('keep the sizes of existing files', async () => {
      const url = await createEmptyDatabase(serverUrl(), 'migrations_with_files');
      await migrateDeployUpTo(url, '0_init');
      await seed(url, [
        `INSERT INTO users (id, email, updated_at) VALUES ('u1', 'u1@example.com', now())`,
        `INSERT INTO data_rooms (id, name, user_id, updated_at) VALUES ('r1', 'Deal', 'u1', now())`,
        `INSERT INTO files (id, name, data_room_id, user_id, file_size, updated_at) VALUES ('d1', 'nda.pdf', 'r1', 'u1', 4194304, now())`,
      ]);

      await migrateDeploy(url);

      const prisma = new PrismaClient({ datasourceUrl: url });
      try {
        await expect(prisma.file.findUnique({ where: { id: 'd1' } })).resolves.toMatchObject({ fileSize: 4194304 });
      } finally {
        await prisma.$disconnect();
      }
    });
  });
});

describe('migrated schema', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ datasourceUrl: serverUrl() });
  });

  afterAll(() => prisma.$disconnect());

  const createUser = () => prisma.user.create({ data: { email: `${randomUUID()}@example.com` } });

  describe('data room names', () => {
    it('are unique per owner', async () => {
      const owner = await createUser();
      await prisma.dataRoom.create({ data: { name: 'Deal', ownerId: owner.id } });

      await expect(prisma.dataRoom.create({ data: { name: 'Deal', ownerId: owner.id } })).rejects.toMatchObject(
        uniqueViolation,
      );
    });

    it('can repeat across owners', async () => {
      const [first, second] = [await createUser(), await createUser()];
      await prisma.dataRoom.create({ data: { name: 'Deal', ownerId: first.id } });

      await expect(prisma.dataRoom.create({ data: { name: 'Deal', ownerId: second.id } })).resolves.toMatchObject({
        name: 'Deal',
      });
    });
  });

  const createDataRoom = async () => {
    const owner = await createUser();
    return prisma.dataRoom.create({ data: { name: 'Deal', ownerId: owner.id } });
  };

  describe('folder names', () => {
    const createFolder = (room: { id: string; ownerId: string }, name: string, parentId: string | null = null) =>
      prisma.folder.create({ data: { name, dataRoomId: room.id, userId: room.ownerId, parentId } });

    it('are unique among root folders of a data room', async () => {
      const room = await createDataRoom();
      await createFolder(room, 'Legal');

      await expect(createFolder(room, 'Legal')).rejects.toMatchObject(uniqueViolation);
    });

    it('are unique among the children of a folder', async () => {
      const room = await createDataRoom();
      const parent = await createFolder(room, 'Legal');
      await createFolder(room, 'Contracts', parent.id);

      await expect(createFolder(room, 'Contracts', parent.id)).rejects.toMatchObject(uniqueViolation);
    });

    it('can repeat under different parents and in different data rooms', async () => {
      const room = await createDataRoom();
      const legal = await createFolder(room, 'Legal');
      const finance = await createFolder(room, 'Finance');
      await createFolder(room, 'Contracts');

      await expect(createFolder(room, 'Contracts', legal.id)).resolves.toMatchObject({ name: 'Contracts' });
      await expect(createFolder(room, 'Contracts', finance.id)).resolves.toMatchObject({ name: 'Contracts' });
      await expect(createFolder(await createDataRoom(), 'Contracts')).resolves.toMatchObject({ name: 'Contracts' });
    });
  });

  describe('file names', () => {
    const createFile = (room: { id: string; ownerId: string }, name: string, folderId: string | null = null) =>
      prisma.file.create({ data: { name, dataRoomId: room.id, userId: room.ownerId, folderId } });
    const createFolder = (room: { id: string; ownerId: string }, name: string) =>
      prisma.folder.create({ data: { name, dataRoomId: room.id, userId: room.ownerId } });

    it('are unique among the root files of a data room', async () => {
      const room = await createDataRoom();
      await createFile(room, 'nda.pdf');

      await expect(createFile(room, 'nda.pdf')).rejects.toMatchObject(uniqueViolation);
    });

    it('are unique within a folder', async () => {
      const room = await createDataRoom();
      const folder = await createFolder(room, 'Legal');
      await createFile(room, 'nda.pdf', folder.id);

      await expect(createFile(room, 'nda.pdf', folder.id)).rejects.toMatchObject(uniqueViolation);
    });

    it('can repeat across folders and data rooms, and match a folder name', async () => {
      const room = await createDataRoom();
      const legal = await createFolder(room, 'Legal');
      const finance = await createFolder(room, 'Finance');
      await createFile(room, 'nda.pdf');

      await expect(createFile(room, 'nda.pdf', legal.id)).resolves.toMatchObject({ name: 'nda.pdf' });
      await expect(createFile(room, 'nda.pdf', finance.id)).resolves.toMatchObject({ name: 'nda.pdf' });
      await expect(createFile(await createDataRoom(), 'nda.pdf')).resolves.toMatchObject({ name: 'nda.pdf' });
      await expect(createFile(room, 'Legal')).resolves.toMatchObject({ name: 'Legal' });
    });
  });

  it('stores file sizes as plain numbers that serialize to JSON', async () => {
    const room = await createDataRoom();
    const file = await prisma.file.create({
      data: { name: 'nda.pdf', dataRoomId: room.id, userId: room.ownerId, fileSize: 4 * 1024 * 1024 },
    });

    expect(JSON.parse(JSON.stringify(file)).fileSize).toBe(4194304);
  });
});

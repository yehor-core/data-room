// Client data module for one data room: reading a level, changing Items and opening Files.
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Contents, File, Folder } from '@/types';
import { toast } from '@/lib/toast';
import { getErrorMessage, SUCCESS_MESSAGES } from '@/lib/errorMessages';
import { api } from './api';
import { queryKeys } from './queryKeys';
import { toItems, type Item } from './items';
import { pendingRecord, useOptimisticMutation } from './optimistic';
import { readStatus } from './readStatus';

/** The cached shape of a level: the server's contents, plus optimistic Items flagged as pending. */
type CachedContents = Contents & {
  folders: (Folder & { pending?: boolean })[];
  files: (File & { pending?: boolean })[];
};

export const contentsQuery = (dataRoomId: string, folderId: string | null) =>
  queryOptions({
    queryKey: queryKeys.contents(dataRoomId, folderId),
    queryFn: () =>
      api.get<CachedContents>(`/data-rooms/${dataRoomId}/contents`, {
        folderId: folderId ?? undefined,
      }),
  });

const toLevel = (contents: CachedContents) => ({
  dataRoomName: contents.dataRoom.name,
  folder: contents.folder,
  breadcrumb: contents.breadcrumb,
  items: toItems(contents.folders, contents.files),
});

/** One level of a data room: its root when folderId is null, otherwise that Folder. */
export function useDataRoomContents(dataRoomId: string, folderId: string | null) {
  const { data, ...query } = useQuery({
    ...contentsQuery(dataRoomId, folderId),
    select: toLevel,
  });
  return {
    items: data?.items ?? [],
    folder: data?.folder ?? null,
    breadcrumb: data?.breadcrumb ?? [],
    dataRoomName: data?.dataRoomName,
    ...readStatus(query),
  };
}

const levelOf = (contents: CachedContents) => contents.folder?.id ?? null;

/** The level `folderId` (null for the root), and the level whose card for that Folder shows its counts. */
const showsContentsOf = (folderId: string | null) => (contents: CachedContents) =>
  levelOf(contents) === folderId || contents.folders.some((folder) => folder.id === folderId);

type Named = { id: string; name: string };

/** What differs between changing a Folder and changing a File. */
interface ItemKind {
  /** The API resource: `/folders/:id`, `/files/:id`. */
  resource: 'folders' | 'files';
  /** Applies `rename` everywhere a level shows the name of this kind of Item. */
  renameIn: (contents: CachedContents, rename: <T extends Named>(entry: T) => T) => CachedContents;
  removeFrom: (contents: CachedContents, id: string) => CachedContents;
  /** The levels that show the Item's name. */
  showsName: (item: Item) => (contents: CachedContents) => boolean;
  /** The data rooms list counts this kind of Item, so creating or deleting one changes it. */
  countedInDataRoomList: boolean;
  renamedMessage: string;
  deletedMessage: string;
}

const KINDS: Record<Item['type'], ItemKind> = {
  folder: {
    resource: 'folders',
    renameIn: (contents, rename) => ({
      ...contents,
      folder: contents.folder && rename(contents.folder),
      breadcrumb: contents.breadcrumb.map(rename),
      folders: contents.folders.map(rename),
    }),
    removeFrom: (contents, id) => ({
      ...contents,
      folders: contents.folders.filter((folder) => folder.id !== id),
    }),
    // Where its card is, its own level and those below it (their breadcrumbs).
    showsName: (item) => (contents) =>
      contents.folders.some((folder) => folder.id === item.id) ||
      contents.breadcrumb.some((crumb) => crumb.id === item.id),
    countedInDataRoomList: true,
    renamedMessage: SUCCESS_MESSAGES.FOLDER_RENAMED,
    deletedMessage: SUCCESS_MESSAGES.FOLDER_DELETED,
  },
  file: {
    resource: 'files',
    renameIn: (contents, rename) => ({ ...contents, files: contents.files.map(rename) }),
    removeFrom: (contents, id) => ({
      ...contents,
      files: contents.files.filter((file) => file.id !== id),
    }),
    showsName: (item) => (contents) => levelOf(contents) === item.parentId,
    countedInDataRoomList: false,
    renamedMessage: SUCCESS_MESSAGES.FILE_RENAMED,
    deletedMessage: SUCCESS_MESSAGES.FILE_DELETED,
  },
};

export function useDataRoomMutations(dataRoomId: string) {
  const queryClient = useQueryClient();
  const room = { scope: queryKeys.dataRoom(dataRoomId) };

  const createFolder = useOptimisticMutation<
    CachedContents,
    { name: string; parentId: string | null },
    Folder
  >({
    ...room,
    mutationFn: ({ name, parentId }) =>
      api.post<Folder>('/folders', { name, dataRoomId, parentId }),
    optimistic:
      ({ name, parentId }) =>
      (contents) => {
        if (levelOf(contents) !== parentId) return contents;
        const folder = {
          ...pendingRecord('folder', name),
          dataRoomId,
          parentId,
          _count: { children: 0, files: 0 },
        };
        return { ...contents, folders: [...contents.folders, folder] };
      },
    affects: ({ parentId }) => showsContentsOf(parentId),
    // The data rooms list counts Folders.
    alsoInvalidate: () => queryKeys.dataRoomList,
    successMessage: () => SUCCESS_MESSAGES.FOLDER_CREATED,
  });

  const uploadFile = useOptimisticMutation<
    CachedContents,
    { file: globalThis.File; name: string; folderId: string | null },
    File
  >({
    ...room,
    mutationFn: async ({ file, name, folderId }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name);
      form.append('dataRoomId', dataRoomId);
      if (folderId) form.append('folderId', folderId);
      const toastId = toast.loading('Uploading file...');
      try {
        return await api.post<File>('/files/upload', form);
      } finally {
        toast.dismiss(toastId);
      }
    },
    confirmed: (uploaded) => (contents) =>
      levelOf(contents) === uploaded.folderId
        ? { ...contents, files: [...contents.files, uploaded] }
        : contents,
    affects: ({ folderId }) => showsContentsOf(folderId),
    successMessage: () => SUCCESS_MESSAGES.FILE_UPLOADED,
  });

  const renameItem = useOptimisticMutation<CachedContents, { item: Item; name: string }, unknown>({
    ...room,
    mutationFn: ({ item, name }) =>
      api.patch(`/${KINDS[item.type].resource}/${item.id}/rename`, { name }),
    optimistic:
      ({ item, name }) =>
      (contents) =>
        KINDS[item.type].renameIn(contents, (entry) =>
          entry.id === item.id ? { ...entry, name: name.trim() } : entry,
        ),
    affects: ({ item }) => KINDS[item.type].showsName(item),
    successMessage: ({ item }) => KINDS[item.type].renamedMessage,
  });

  const deleteItem = useOptimisticMutation<CachedContents, Item, void>({
    ...room,
    mutationFn: (item) => api.delete(`/${KINDS[item.type].resource}/${item.id}`),
    optimistic: (item) => (contents) => KINDS[item.type].removeFrom(contents, item.id),
    onConfirmed: (item) => {
      if (item.type !== 'folder') return;
      // The Folder's own level and every level below it are gone.
      queryClient.removeQueries({ queryKey: queryKeys.contents(dataRoomId, item.id) });
      queryClient.removeQueries({
        queryKey: room.scope,
        predicate: ({ state }) =>
          (state.data as CachedContents | undefined)?.breadcrumb.some(
            (crumb) => crumb.id === item.id,
          ) ?? false,
      });
    },
    affects: (item) => showsContentsOf(item.parentId),
    alsoInvalidate: (item) =>
      KINDS[item.type].countedInDataRoomList ? queryKeys.dataRoomList : null,
    successMessage: (item) => KINDS[item.type].deletedMessage,
  });

  return { createFolder, uploadFile, renameItem, deleteItem };
}

/**
 * Opens a File in a new tab through a short-lived signed URL. The tab is opened before the request so that
 * browsers still treat it as a response to the click and don't block it as a popup.
 */
export async function openFile(fileId: string) {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const { url } = await api.get<{ url: string }>(`/files/${fileId}/view`);
    if (tab) {
      tab.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (error) {
    tab?.close();
    toast.error(getErrorMessage(error));
  }
}

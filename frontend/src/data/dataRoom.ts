// Client data module for one data room: reading a level, changing Items and opening Files.
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Contents, File, Folder } from '@/types';
import { toast } from '@/lib/toast';
import { getErrorMessage, SUCCESS_MESSAGES } from '@/lib/errorMessages';
import { api } from './api';
import { queryKeys } from './queryKeys';
import { toItems, type Item } from './items';
import { useOptimisticMutation } from './optimistic';

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
  const { data, isPending, error, refetch } = useQuery({
    ...contentsQuery(dataRoomId, folderId),
    select: toLevel,
  });
  return {
    items: data?.items ?? [],
    folder: data?.folder ?? null,
    breadcrumb: data?.breadcrumb ?? [],
    dataRoomName: data?.dataRoomName,
    isLoading: isPending && !error,
    error,
    retry: () => void refetch(),
  };
}

const levelOf = (contents: CachedContents) => contents.folder?.id ?? null;

let pendingIds = 0;

export function useDataRoomMutations(dataRoomId: string) {
  const queryClient = useQueryClient();
  const room = {
    scope: queryKeys.dataRoom(dataRoomId),
    alsoInvalidate: queryKeys.dataRoomList,
  };

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
        const timestamp = new Date().toISOString();
        const folder = {
          id: `pending-folder-${++pendingIds}`,
          name: name.trim(),
          dataRoomId,
          parentId,
          createdAt: timestamp,
          updatedAt: timestamp,
          _count: { children: 0, files: 0 },
          pending: true,
        };
        return { ...contents, folders: [...contents.folders, folder] };
      },
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
    successMessage: () => SUCCESS_MESSAGES.FILE_UPLOADED,
  });

  const renameItem = useOptimisticMutation<CachedContents, { item: Item; name: string }, unknown>({
    ...room,
    mutationFn: ({ item, name }) =>
      api.patch(`/${item.type === 'folder' ? 'folders' : 'files'}/${item.id}/rename`, { name }),
    optimistic:
      ({ item, name }) =>
      (contents) => {
        const rename = <T extends { id: string; name: string }>(entry: T): T =>
          entry.id === item.id ? { ...entry, name: name.trim() } : entry;
        return item.type === 'folder'
          ? {
              ...contents,
              folder: contents.folder && rename(contents.folder),
              breadcrumb: contents.breadcrumb.map(rename),
              folders: contents.folders.map(rename),
            }
          : { ...contents, files: contents.files.map(rename) };
      },
    successMessage: ({ item }) =>
      item.type === 'folder' ? SUCCESS_MESSAGES.FOLDER_RENAMED : SUCCESS_MESSAGES.FILE_RENAMED,
  });

  const deleteItem = useOptimisticMutation<CachedContents, Item, void>({
    ...room,
    mutationFn: (item) => api.delete(`/${item.type === 'folder' ? 'folders' : 'files'}/${item.id}`),
    optimistic: (item) => (contents) =>
      item.type === 'folder'
        ? { ...contents, folders: contents.folders.filter((folder) => folder.id !== item.id) }
        : { ...contents, files: contents.files.filter((file) => file.id !== item.id) },
    onConfirmed: (item) => {
      if (item.type === 'folder') {
        queryClient.removeQueries({ queryKey: queryKeys.contents(dataRoomId, item.id) });
      }
    },
    successMessage: (item) =>
      item.type === 'folder' ? SUCCESS_MESSAGES.FOLDER_DELETED : SUCCESS_MESSAGES.FILE_DELETED,
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

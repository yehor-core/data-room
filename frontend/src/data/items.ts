import type { File, Folder } from '@/types';

interface ItemBase {
  id: string;
  name: string;
  /** The Folder the Item sits in; null at the data room root. */
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Created optimistically and not yet confirmed by the server. */
  pending: boolean;
}

export type FolderItem = ItemBase & { type: 'folder'; childCount: number; fileCount: number };
export type FileItem = ItemBase & { type: 'file'; size: number | undefined };
/** A Folder or a File of one data room level, in the one shape every view renders. */
export type Item = FolderItem | FileItem;

type Pending = { pending?: boolean };

const folderItem = (folder: Folder & Pending): FolderItem => ({
  type: 'folder',
  id: folder.id,
  name: folder.name,
  parentId: folder.parentId,
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt,
  pending: !!folder.pending,
  childCount: folder._count.children,
  fileCount: folder._count.files,
});

const fileItem = (file: File & Pending): FileItem => ({
  type: 'file',
  id: file.id,
  name: file.name,
  parentId: file.folderId,
  createdAt: file.createdAt,
  updatedAt: file.updatedAt,
  pending: !!file.pending,
  size: file.fileSize ?? undefined,
});

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name);

/** Folders first, then Files, each group sorted by name. */
export const toItems = (folders: (Folder & Pending)[], files: (File & Pending)[]): Item[] => [
  ...folders.map(folderItem).sort(byName),
  ...files.map(fileItem).sort(byName),
];

/** The Items whose name contains the query, ignoring case and surrounding spaces. */
export const filterItems = (items: Item[], query: string): Item[] => {
  const needle = query.trim().toLowerCase();
  return needle ? items.filter((item) => item.name.toLowerCase().includes(needle)) : items;
};

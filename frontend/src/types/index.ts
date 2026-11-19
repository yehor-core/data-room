// Response shapes of the backend API. Dates are ISO strings, sizes are bytes.

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataRoom {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  _count: { folders: number; files: number };
}

export interface Folder {
  id: string;
  name: string;
  dataRoomId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { children: number; files: number };
}

export interface File {
  id: string;
  name: string;
  dataRoomId: string;
  folderId: string | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

/** One level of a data room: its root (`folder` is null) or one Folder. */
export interface Contents {
  dataRoom: { id: string; name: string };
  folder: { id: string; name: string; parentId: string | null } | null;
  breadcrumb: BreadcrumbItem[];
  folders: Folder[];
  files: File[];
}

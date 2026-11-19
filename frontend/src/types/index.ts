export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataRoom {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    folders?: number;
    files?: number;
  };
  folders?: Folder[];
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  dataRoomId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    children: number;
    files: number;
  };
  children?: Folder[];
  files?: File[];
}

export interface FolderWithChildren extends Folder {
  children: Folder[];
  files: File[];
}

export interface File {
  id: string;
  name: string;
  mimeType?: string;
  fileSize?: number | null;
  folderId: string;
  filePath?: string;
  createdAt: string;
  updatedAt: string;
  folder?: {
    id: string;
    name: string;
    dataRoomId: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

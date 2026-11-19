// An in-memory stand-in for the backend, served through MSW. It follows the API contract (envelopes, error codes,
// contents shape) closely enough for screens to behave as they do against the real server. Tests seed it through
// the `seed*` helpers and override single endpoints with `server.use(...)` to simulate failures.
import { http, HttpResponse, type JsonBodyType } from 'msw';
import type { Contents, DataRoom, File, Folder, User } from '@/types';
import { API_URL, SUPABASE_URL } from './urls';

export const testUser: User = {
  id: 'user-1',
  email: 'owner@example.com',
  name: 'Olivia Owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

type StoredFolder = Omit<Folder, '_count'>;

const db = {
  dataRooms: [] as Omit<DataRoom, '_count'>[],
  folders: [] as StoredFolder[],
  files: [] as File[],
};

let nextId = 1;
const newId = (prefix: string) => `${prefix}-${nextId++}`;
let clock = Date.parse('2026-03-01T09:00:00.000Z');
const now = () => new Date((clock += 60_000)).toISOString();

export function resetFakeApi() {
  db.dataRooms = [];
  db.folders = [];
  db.files = [];
  nextId = 1;
}

export function seedDataRoom(name: string) {
  const room = {
    id: newId('room'),
    name,
    ownerId: testUser.id,
    createdAt: now(),
    updatedAt: now(),
  };
  db.dataRooms.push(room);
  return room;
}

export function seedFolder(dataRoomId: string, name: string, parentId: string | null = null) {
  const folder: StoredFolder = {
    id: newId('folder'),
    name,
    dataRoomId,
    parentId,
    createdAt: now(),
    updatedAt: now(),
  };
  db.folders.push(folder);
  return folder;
}

export function seedFile(
  dataRoomId: string,
  name: string,
  { folderId = null, fileSize = 1024 }: { folderId?: string | null; fileSize?: number } = {},
) {
  const file: File = {
    id: newId('file'),
    name,
    dataRoomId,
    folderId,
    fileSize,
    mimeType: 'application/pdf',
    createdAt: now(),
    updatedAt: now(),
  };
  db.files.push(file);
  return file;
}

const ok = (data: JsonBodyType, status = 200) =>
  HttpResponse.json({ success: true, data }, { status });

export const apiError = (status: number, code: string, message: string) =>
  HttpResponse.json({ success: false, error: { code, message } }, { status });

const notFound = (what: string) => apiError(404, 'NOT_FOUND', `${what} not found`);
const conflict = (message: string) => apiError(409, 'CONFLICT', message);

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

const withCounts = (folder: StoredFolder): Folder => ({
  ...folder,
  _count: {
    children: db.folders.filter((f) => f.parentId === folder.id).length,
    files: db.files.filter((f) => f.folderId === folder.id).length,
  },
});

const withRoomCounts = (room: Omit<DataRoom, '_count'>): DataRoom => ({
  ...room,
  _count: {
    folders: db.folders.filter((f) => f.dataRoomId === room.id).length,
    files: db.files.filter((f) => f.dataRoomId === room.id).length,
  },
});

function contents(roomId: string, folderId: string | null): Contents | 'room' | 'folder' {
  const room = db.dataRooms.find((r) => r.id === roomId);
  if (!room) return 'room';
  const folder = folderId
    ? db.folders.find((f) => f.id === folderId && f.dataRoomId === roomId)
    : null;
  if (folderId && !folder) return 'folder';

  const breadcrumb = [];
  for (let at = folder; at; at = db.folders.find((f) => f.id === at?.parentId)) {
    breadcrumb.unshift({ id: at.id, name: at.name });
  }
  return {
    dataRoom: { id: room.id, name: room.name },
    folder: folder ? { id: folder.id, name: folder.name, parentId: folder.parentId } : null,
    breadcrumb,
    folders: db.folders
      .filter((f) => f.dataRoomId === roomId && f.parentId === (folderId ?? null))
      .sort(byName)
      .map(withCounts),
    files: db.files
      .filter((f) => f.dataRoomId === roomId && f.folderId === (folderId ?? null))
      .sort(byName),
  };
}

function deleteFolderTree(folderId: string) {
  for (const child of db.folders.filter((f) => f.parentId === folderId)) deleteFolderTree(child.id);
  db.files = db.files.filter((f) => f.folderId !== folderId);
  db.folders = db.folders.filter((f) => f.id !== folderId);
}

export const signedUrl = (fileId: string) =>
  `https://storage.test/signed/${fileId}?token=short-lived`;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const handlers = [
  http.get(`${API_URL}/auth/me`, () => ok(testUser)),

  http.get(`${API_URL}/data-rooms`, () =>
    ok(
      [...db.dataRooms].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(withRoomCounts),
    ),
  ),
  http.post(`${API_URL}/data-rooms`, async ({ request }) => {
    const { name } = (await request.json()) as { name: string };
    if (db.dataRooms.some((r) => r.name === name.trim())) {
      return conflict('A data room with this name already exists');
    }
    return ok(withRoomCounts(seedDataRoom(name.trim())), 201);
  }),
  http.delete(`${API_URL}/data-rooms/:id`, ({ params }) => {
    if (!db.dataRooms.some((r) => r.id === params.id)) return notFound('Data room');
    db.dataRooms = db.dataRooms.filter((r) => r.id !== params.id);
    db.folders = db.folders.filter((f) => f.dataRoomId !== params.id);
    db.files = db.files.filter((f) => f.dataRoomId !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_URL}/data-rooms/:id/contents`, ({ params, request }) => {
    const folderId = new URL(request.url).searchParams.get('folderId') || null;
    const result = contents(params.id as string, folderId);
    if (result === 'room') return notFound('Data room');
    if (result === 'folder') return notFound('Folder');
    return ok(result as unknown as JsonBodyType);
  }),

  http.post(`${API_URL}/folders`, async ({ request }) => {
    const body = (await request.json()) as { name: string; dataRoomId: string; parentId?: string };
    const name = body.name.trim();
    const parentId = body.parentId || null;
    const siblings = db.folders.filter(
      (f) => f.dataRoomId === body.dataRoomId && f.parentId === parentId,
    );
    if (siblings.some((f) => f.name === name)) {
      return conflict('A folder with this name already exists in this location');
    }
    return ok(withCounts(seedFolder(body.dataRoomId, name, parentId)), 201);
  }),
  http.patch(`${API_URL}/folders/:id/rename`, async ({ params, request }) => {
    const { name } = (await request.json()) as { name: string };
    const folder = db.folders.find((f) => f.id === params.id);
    if (!folder) return notFound('Folder');
    const clash = db.folders.some(
      (f) =>
        f.id !== folder.id &&
        f.dataRoomId === folder.dataRoomId &&
        f.parentId === folder.parentId &&
        f.name === name.trim(),
    );
    if (clash) return conflict('A folder with this name already exists in this location');
    folder.name = name.trim();
    folder.updatedAt = now();
    return ok(withCounts(folder));
  }),
  http.delete(`${API_URL}/folders/:id`, ({ params }) => {
    if (!db.folders.some((f) => f.id === params.id)) return notFound('Folder');
    deleteFolderTree(params.id as string);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_URL}/files/upload`, async ({ request }) => {
    const form = await request.formData();
    const upload = form.get('file') as globalThis.File;
    const dataRoomId = String(form.get('dataRoomId'));
    const folderId = (form.get('folderId') as string | null) || null;
    const name = String(form.get('name') || upload.name).trim();
    if (upload.size > MAX_UPLOAD_BYTES) {
      return apiError(413, 'PAYLOAD_TOO_LARGE', 'File is larger than the 4 MB limit');
    }
    if (upload.type !== 'application/pdf') {
      return apiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only PDF files are accepted');
    }
    const clash = db.files.some(
      (f) => f.dataRoomId === dataRoomId && f.folderId === folderId && f.name === name,
    );
    if (clash) return conflict('A file with this name already exists in this location');
    return ok(seedFile(dataRoomId, name, { folderId, fileSize: upload.size }), 201);
  }),
  http.patch(`${API_URL}/files/:id/rename`, async ({ params, request }) => {
    const { name } = (await request.json()) as { name: string };
    const file = db.files.find((f) => f.id === params.id);
    if (!file) return notFound('File');
    const clash = db.files.some(
      (f) =>
        f.id !== file.id &&
        f.dataRoomId === file.dataRoomId &&
        f.folderId === file.folderId &&
        f.name === name.trim(),
    );
    if (clash) return conflict('A file with this name already exists in this location');
    file.name = name.trim();
    file.updatedAt = now();
    return ok(file);
  }),
  http.get(`${API_URL}/files/:id/view`, ({ params }) => {
    if (!db.files.some((f) => f.id === params.id)) return notFound('File');
    return ok({ url: signedUrl(params.id as string) });
  }),
  http.delete(`${API_URL}/files/:id`, ({ params }) => {
    if (!db.files.some((f) => f.id === params.id)) return notFound('File');
    db.files = db.files.filter((f) => f.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // Supabase Auth. A refresh is refused by default, which is what an expired session looks like.
  http.post(`${SUPABASE_URL}/auth/v1/token`, () =>
    HttpResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid Refresh Token' },
      { status: 400 },
    ),
  ),
  http.post(`${SUPABASE_URL}/auth/v1/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${SUPABASE_URL}/auth/v1/user`, () => HttpResponse.json(supabaseUser)),
];

export const supabaseUser = {
  id: 'supabase-user-1',
  aud: 'authenticated',
  role: 'authenticated',
  email: testUser.email,
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: testUser.name },
  created_at: testUser.createdAt,
};

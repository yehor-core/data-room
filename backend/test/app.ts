import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app';
import { capturingLogger, FakeTokenVerifier, InMemoryStorage } from './adapters';

export const allowedOrigin = 'http://localhost:3000';

let db: PrismaClient | undefined;
afterAll(() => db?.$disconnect());

/**
 * Assembles the app the way production does, but with a real test Postgres,
 * in-memory file storage, a fake token verifier and a logger the test can read.
 */
export function createTestApp() {
  db ??= new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const storage = new InMemoryStorage();
  const tokenVerifier = new FakeTokenVerifier();
  const { logger, lines: logs } = capturingLogger();
  const app = createApp({
    db,
    storage,
    tokenVerifier,
    logger,
    config: { allowedOrigins: [allowedOrigin] },
  });

  const as = (token: string) => ({
    get: (url: string) => request(app).get(url).auth(token, { type: 'bearer' }),
    post: (url: string) => request(app).post(url).auth(token, { type: 'bearer' }),
    patch: (url: string) => request(app).patch(url).auth(token, { type: 'bearer' }),
    put: (url: string) => request(app).put(url).auth(token, { type: 'bearer' }),
    delete: (url: string) => request(app).delete(url).auth(token, { type: 'bearer' }),
  });

  /** A user with a valid token; the account is created by their first request. */
  const newUser = (name: string | null = 'Test Owner') => {
    const email = `${randomUUID()}@example.com`;
    const token = tokenVerifier.issue({ email, name });
    return { email, token, ...as(token) };
  };

  return { app, storage, tokenVerifier, logs, newUser, anonymous: () => request(app) };
}

export type TestUser = ReturnType<ReturnType<typeof createTestApp>['newUser']>;

export const pdf = (text = 'hello') => Buffer.from(`%PDF-1.7\n${text}\n%%EOF\n`);

export async function createDataRoom(user: TestUser, name = 'Deal room') {
  const res = await user.post('/api/data-rooms').send({ name }).expect(201);
  return res.body.data as { id: string; name: string };
}

export async function createFolder(
  user: TestUser,
  dataRoomId: string,
  name: string,
  parentId?: string,
) {
  const res = await user.post('/api/folders').send({ name, dataRoomId, parentId }).expect(201);
  return res.body.data as { id: string; name: string; parentId: string | null };
}

export function upload(
  user: TestUser,
  fields: { dataRoomId: string; folderId?: string; name?: string },
  file: { content?: Buffer; filename?: string; contentType?: string } = {},
) {
  const req = user.post('/api/files/upload').field('dataRoomId', fields.dataRoomId);
  if (fields.folderId) req.field('folderId', fields.folderId);
  if (fields.name) req.field('name', fields.name);
  return req.attach('file', file.content ?? pdf(), {
    filename: file.filename ?? 'document.pdf',
    contentType: file.contentType ?? 'application/pdf',
  });
}

export async function uploadFile(
  user: TestUser,
  fields: { dataRoomId: string; folderId?: string; name: string },
  content = pdf(),
) {
  const res = await upload(user, fields, { content }).expect(201);
  return res.body.data as {
    id: string;
    name: string;
    folderId: string | null;
    fileSize: number;
    mimeType: string;
  };
}

export async function contents(user: TestUser, dataRoomId: string, folderId?: string) {
  const res = await user
    .get(`/api/data-rooms/${dataRoomId}/contents`)
    .query(folderId ? { folderId } : {})
    .expect(200);
  return res.body.data as {
    dataRoom: { id: string; name: string };
    folder: { id: string; name: string; parentId: string | null } | null;
    breadcrumb: { id: string; name: string }[];
    folders: { id: string; name: string; _count: { children: number; files: number } }[];
    files: { id: string; name: string; fileSize: number; mimeType: string }[];
  };
}

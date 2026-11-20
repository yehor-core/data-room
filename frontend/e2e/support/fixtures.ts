import { randomInt, randomUUID } from 'node:crypto';
import {
  test as base,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { BACKEND_URL, localSupabase, STORAGE_BUCKET } from './stack';
import { owner, signIn, type TestUser } from './users';

/**
 * The backend allows 100 requests per 15 minutes per client IP and trusts one proxy hop, as on Vercel. Each browser
 * context and API client acts as its own client behind that proxy, so the suite as a whole stays within the limit
 * while every test still runs against the real limiter.
 */
const clientIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

async function actAsOneClient(context: BrowserContext): Promise<void> {
  const ip = clientIp();
  await context.route(`${BACKEND_URL}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': ip } }),
  );
}

/** The backend HTTP API as one signed-in user: for preparing data and for checking what the server holds. */
export interface Api {
  createDataRoom(name: string): Promise<{ id: string; name: string }>;
  createFolder(input: {
    dataRoomId: string;
    name: string;
    parentId?: string;
  }): Promise<{ id: string; name: string }>;
  uploadFile(input: {
    dataRoomId: string;
    folderId?: string;
    file: { name: string; mimeType: string; buffer: Buffer };
  }): Promise<{ id: string; name: string; filePath: string }>;
  /** The status of a GET under `/api`. */
  status(path: string): Promise<number>;
}

async function signedInApi(request: APIRequestContext, user: TestUser) {
  const { accessToken } = await signIn(user);
  const headers = { Authorization: `Bearer ${accessToken}`, 'X-Forwarded-For': clientIp() };
  const data = async <T>(response: Awaited<ReturnType<APIRequestContext['get']>>) => {
    if (!response.ok()) {
      throw new Error(`${response.url()} answered ${response.status()}: ${await response.text()}`);
    }
    return ((await response.json()) as { data: T }).data;
  };

  const api: Api = {
    createDataRoom: async (name) =>
      data(await request.post(`${BACKEND_URL}/api/data-rooms`, { headers, data: { name } })),
    createFolder: async (input) =>
      data(await request.post(`${BACKEND_URL}/api/folders`, { headers, data: input })),
    uploadFile: async ({ dataRoomId, folderId, file }) =>
      data(
        await request.post(`${BACKEND_URL}/api/files/upload`, {
          headers,
          multipart: { dataRoomId, ...(folderId ? { folderId } : {}), file },
        }),
      ),
    status: async (path) => (await request.get(`${BACKEND_URL}/api${path}`, { headers })).status(),
  };
  return api;
}

/** Whether Supabase Storage still holds an object, asked with the service role. */
export async function isStored(filePath: string): Promise<boolean> {
  const { apiUrl, serviceRoleKey } = localSupabase();
  const storage = createClient(apiUrl, serviceRoleKey).storage.from(STORAGE_BUCKET);
  // Answers false for a missing object and throws on any other failure.
  const { data } = await storage.exists(filePath);
  return data;
}

/** A name no other test uses, so tests can share the owner's account and run in parallel. */
export const uniqueName = (prefix: string) => `${prefix} ${randomUUID().slice(0, 8)}`;

export const test = base.extend<{
  /** The API as any user. */
  apiAs: (user: TestUser) => Promise<Api>;
  /** The API as the owner. */
  api: Api;
  /** Opens the app in a separate browser as another user. */
  openAs: (user: TestUser) => Promise<Page>;
}>({
  storageState: owner.storageState,

  context: async ({ context }, use) => {
    await actAsOneClient(context);
    await use(context);
  },

  apiAs: async ({ playwright }, use) => {
    const request = await playwright.request.newContext();
    await use((user) => signedInApi(request, user));
    await request.dispose();
  },

  api: async ({ apiAs }, use) => {
    await use(await apiAs(owner));
  },

  openAs: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (user) => {
      const context = await browser.newContext({ storageState: user.storageState });
      contexts.push(context);
      await actAsOneClient(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect } from '@playwright/test';

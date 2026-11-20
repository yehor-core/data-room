import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { FRONTEND_URL, localSupabase } from './stack';

export interface TestUser {
  email: string;
  /** Playwright storage state of a browser in which this user is signed in. */
  storageState: string;
}

// Local stack only; these users never exist anywhere else.
const PASSWORD = 'e2e-local-password';

const userNamed = (name: string): TestUser => ({
  email: `e2e-${name}@example.com`,
  storageState: path.join(__dirname, '../.auth', `${name}.json`),
});

/** Owns every data room the scenarios create. */
export const owner = userNamed('owner');
/** A second user who must not see or open the owner's resources. */
export const outsider = userNamed('outsider');

/** A user nobody has signed in as yet, so the app has no account for them. */
export const freshUser = (): TestUser => userNamed(`fresh-${randomUUID()}`);

const serviceClient = () => {
  const { apiUrl, serviceRoleKey } = localSupabase();
  return createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

/** Creates the user through the local Supabase admin API; an existing user is kept. */
export async function createUser({ email }: TestUser): Promise<void> {
  const { error } = await serviceClient().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error && error.code !== 'email_exists') throw error;
}

/**
 * Signs the user in with their password the way the browser client would, and returns the access token plus what
 * supabase-js stores in localStorage for that session.
 */
export async function signIn({ email }: TestUser) {
  const stored = new Map<string, string>();
  const { apiUrl, anonKey } = localSupabase();
  const client = createClient(apiUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      storage: {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => void stored.set(key, value),
        removeItem: (key) => void stored.delete(key),
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return { accessToken: data.session.access_token, localStorage: stored };
}

/** Saves a storage state in which the frontend finds the user's session, as if they had just signed in. */
export async function saveStorageState(user: TestUser): Promise<{ accessToken: string }> {
  const { accessToken, localStorage } = await signIn(user);
  const state = {
    cookies: [],
    origins: [
      {
        origin: FRONTEND_URL,
        localStorage: [...localStorage].map(([name, value]) => ({ name, value })),
      },
    ],
  };
  await mkdir(path.dirname(user.storageState), { recursive: true });
  await writeFile(user.storageState, JSON.stringify(state, null, 2));
  return { accessToken };
}

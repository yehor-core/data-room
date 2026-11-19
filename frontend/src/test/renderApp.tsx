// Renders the whole app (real providers, real routes, real client data module) in a memory router, with the
// network served by MSW.
import { server } from './server';
import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http } from 'msw';
import { AppProviders, AppRoutes } from '@/App';
import { createQueryClient } from '@/data/queryClient';
import { supabaseUser } from './fakeApi';

export { server };

// supabase-js keeps its session in localStorage under `sb-<project ref>-auth-token`.
const SESSION_KEY = 'sb-supabase-auth-token';

export function storeSession({ expired = false } = {}) {
  const expiresAt = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      user: supabaseUser,
    }),
  );
}

export function renderApp(path = '/', { signedIn = true } = {}) {
  if (signedIn) storeSession();
  const queryClient = createQueryClient();
  // Retries only slow tests down; every failure a test simulates is meant to be final.
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
  const user = userEvent.setup();
  render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
  return { user };
}

/**
 * Holds matching requests until the returned function is called; they are then answered as usual.
 * Lets a test look at the UI while a change is still pending.
 */
export function holdRequests(method: 'get' | 'post' | 'patch' | 'delete', url: string) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  // A resolver that returns nothing passes the request on to the next matching handler.
  server.use(http[method](url, () => gate.then(() => undefined)));
  return release;
}

import { setupServer } from 'msw/node';
import { handlers, resetFakeApi } from './fakeApi';

export const server = setupServer(...handlers);

// Listening starts on import, not in beforeAll: supabase-js keeps the `fetch` it finds when its client is
// created, so MSW must have patched fetch before the app modules load. Import this module before the app.
server.listen({ onUnhandledRequest: 'error' });

afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  resetFakeApi();
  localStorage.clear();
  // The toast container is a singleton owned by the toast module: empty it instead of removing it.
  document.getElementById('toast-container')?.replaceChildren();
});
afterAll(() => server.close());

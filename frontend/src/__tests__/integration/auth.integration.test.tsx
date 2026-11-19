import { screen } from '@testing-library/react';
import { http } from 'msw';
import { renderApp, server, storeSession } from '@/test/renderApp';
import { seedDataRoom, testUser } from '@/test/fakeApi';
import { API_URL } from '@/test/urls';

const loginPage = () => screen.findByRole('button', { name: /continue with google/i });

describe('Authentication', () => {
  it('loads my profile once per app start and shows who is signed in', async () => {
    seedDataRoom('Deals');
    let profileRequests = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.url === `${API_URL}/auth/me`) profileRequests++;
    });

    renderApp('/');

    expect(await screen.findByText('Deals')).toBeInTheDocument();
    expect(screen.getByText('Olivia Owner')).toBeInTheDocument();
    expect(profileRequests).toBe(1);
  });

  it('sends a signed-out visitor to the sign-in page', async () => {
    renderApp('/data-rooms/room-1', { signedIn: false });

    expect(await loginPage()).toBeInTheDocument();
  });

  it('returns me to the sign-in page when my session has expired', async () => {
    // supabase-js itself logs the refused refresh; keep the test output clean.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    storeSession({ expired: true });
    renderApp('/', { signedIn: false });

    expect(await loginPage()).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('returns me to the sign-in page when I sign out', async () => {
    seedDataRoom('Deals');
    const { user } = renderApp('/');
    await screen.findByText('Deals');

    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(await loginPage()).toBeInTheDocument();
  });

  it('shows the sign-in page, not an error, when the profile cannot be loaded', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () => new Response(null, { status: 401 }), { once: true }),
    );
    renderApp('/');

    expect(await loginPage()).toBeInTheDocument();
  });

  it('writes no session, token or email to the browser console', async () => {
    const spies = (['log', 'info', 'debug', 'warn', 'error'] as const).map((method) =>
      jest.spyOn(console, method),
    );
    seedDataRoom('Deals');
    const { user } = renderApp('/');
    await screen.findByText('Deals');
    await user.click(screen.getByRole('button', { name: /logout/i }));
    await loginPage();

    const written = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    for (const secret of ['test-access-token', 'test-refresh-token', testUser.email]) {
      expect(written).not.toContain(secret);
    }
    spies.forEach((spy) => spy.mockRestore());
  });
});

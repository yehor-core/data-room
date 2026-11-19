// Must come first: it puts the app on the Google sign-in redirect URL before supabase-js starts.
import '@/test/oauthRedirect';
import { screen } from '@testing-library/react';
import { renderApp } from '@/test/renderApp';
import { seedDataRoom } from '@/test/fakeApi';

describe('Signing in with Google', () => {
  it('lands me on my data rooms list with my account loaded', async () => {
    seedDataRoom('Deals');

    renderApp('/login', { signedIn: false });

    expect(await screen.findByRole('heading', { name: 'Data Rooms' })).toBeInTheDocument();
    expect(await screen.findByText('Deals')).toBeInTheDocument();
    expect(screen.getByText('Olivia Owner')).toBeInTheDocument();
  });
});

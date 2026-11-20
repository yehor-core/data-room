import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderApp, server, holdRequests } from '@/test/renderApp';
import { seedDataRoom, seedFolder } from '@/test/fakeApi';
import { API_URL } from '@/test/urls';

const card = (name: string) => screen.getByRole('listitem', { name });

describe('Data rooms list', () => {
  it('shows my data rooms with their folder counts', async () => {
    const deals = seedDataRoom('Deals');
    seedFolder(deals.id, 'Contracts');
    seedDataRoom('Board');

    renderApp('/');

    expect(await screen.findByText('Deals')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
    expect(screen.getByText('1 folder')).toBeInTheDocument();
  });

  it('creates a data room, showing it as pending until the server confirms', async () => {
    const release = holdRequests('post', `${API_URL}/data-rooms`);
    const { user } = renderApp('/');
    await screen.findByText('No Data Rooms Yet');

    await user.click(screen.getByRole('button', { name: 'New Data Room' }));
    await user.type(screen.getByLabelText('Name'), 'Series A');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Series A')).toBeInTheDocument();
    expect(within(card('Series A')).getByRole('button', { name: 'Creating...' })).toBeDisabled();

    release();
    // The confirmed card replaces the pending one, so look it up afresh.
    await waitFor(() =>
      expect(within(card('Series A')).getByRole('link', { name: 'Open' })).toBeInTheDocument(),
    );
    expect(await screen.findByText('Data room created successfully!')).toBeInTheDocument();
  });

  it('rejects a name I already use, removes the optimistic card and says why once', async () => {
    seedDataRoom('Deals');
    const { user } = renderApp('/');
    await screen.findByText('Deals');
    // Hold the refetch that follows the failure, so only the rollback can remove the card.
    holdRequests('get', `${API_URL}/data-rooms`);

    await user.click(screen.getByRole('button', { name: 'New Data Room' }));
    await user.type(screen.getByLabelText('Name'), 'Deals');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText('A data room with this name already exists'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getAllByText('A data room with this name already exists')).toHaveLength(1);
  });

  it('deletes a data room only after confirmation', async () => {
    seedDataRoom('Deals');
    seedDataRoom('Board');
    const { user } = renderApp('/');
    await screen.findByText('Deals');

    await user.click(screen.getByRole('button', { name: 'Delete Deals' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Deals')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Deals' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.queryByText('Deals')).not.toBeInTheDocument());
    expect(await screen.findByText('Data room deleted successfully!')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('shows an error state with retry, not an empty list, when loading fails', async () => {
    seedDataRoom('Deals');
    server.use(http.get(`${API_URL}/data-rooms`, () => HttpResponse.error(), { once: true }));
    const { user } = renderApp('/');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to connect');
    expect(screen.queryByText('No Data Rooms Yet')).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Deals')).toBeInTheDocument();
  });
});

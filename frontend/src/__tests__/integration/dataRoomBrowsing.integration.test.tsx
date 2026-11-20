import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderApp, server } from '@/test/renderApp';
import { apiError, seedDataRoom, seedFile, seedFolder } from '@/test/fakeApi';
import { gridNames, main, tableNames, tree } from '@/test/screen';
import { API_URL } from '@/test/urls';

function seedDeals() {
  const room = seedDataRoom('Deals');
  const contracts = seedFolder(room.id, 'Contracts');
  const board = seedFolder(room.id, 'board minutes');
  const ndas = seedFolder(room.id, 'NDAs', contracts.id);
  seedFile(room.id, 'term sheet', { fileSize: 3000 });
  seedFile(room.id, 'Budget', { fileSize: 1_048_576 });
  seedFile(room.id, 'Cap table', { fileSize: 10 });
  seedFile(room.id, 'msa', { folderId: contracts.id, fileSize: 2048 });
  return { room, contracts, board, ndas };
}

/** Waits until the screen shows this level. */
const showsLevel = (name: string) => screen.findByRole('heading', { level: 1, name });

describe('Browsing a data room', () => {
  it('lists Folders first, then Files, each sorted by name', async () => {
    const { room } = seedDeals();
    renderApp(`/data-rooms/${room.id}`);

    await showsLevel('Deals');
    await waitFor(() => expect(gridNames('Folders')).toEqual(['board minutes', 'Contracts']));
    expect(gridNames('Files')).toEqual(['Budget', 'Cap table', 'term sheet']);
    expect(main().getByText('1 folder · 1 file')).toBeInTheDocument();
  });

  it('shows a Folder with the same screen as the root', async () => {
    const { room, contracts } = seedDeals();
    renderApp(`/data-rooms/${room.id}/folders/${contracts.id}`);

    await showsLevel('Contracts');
    await waitFor(() => expect(gridNames('Folders')).toEqual(['NDAs']));
    expect(gridNames('Files')).toEqual(['msa']);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'List view' })).toBeInTheDocument();
    expect(main().getByRole('button', { name: 'New Folder' })).toBeInTheDocument();
    expect(main().getByRole('button', { name: 'Upload File' })).toBeInTheDocument();
  });

  it('opens a Folder from its card', async () => {
    const { room } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}`);
    await showsLevel('Deals');

    await user.click(await main().findByRole('button', { name: /^Contracts/ }));

    await showsLevel('Contracts');
    await waitFor(() => expect(gridNames('Files')).toEqual(['msa']));
  });

  it('searches the current level by name, ignoring case', async () => {
    const { room } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}`);
    await waitFor(() => expect(gridNames('Files')).toHaveLength(3));

    await user.type(screen.getByRole('searchbox'), 'BUD');

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Folders' })).toBeNull());
    expect(gridNames('Files')).toEqual(['Budget']);
  });

  it('shows a distinct empty state when the search matches nothing, with a way to clear it', async () => {
    const { room } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}`);
    await waitFor(() => expect(gridNames('Files')).toHaveLength(3));

    await user.type(screen.getByRole('searchbox'), 'nothing like this');

    expect(await screen.findByText('No results found')).toBeInTheDocument();
    expect(screen.queryByText('No files or folders yet')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear Search' }));
    await waitFor(() => expect(gridNames('Files')).toHaveLength(3));
  });

  it.each([
    ['the root', false],
    ['a Folder', true],
  ])('offers creating a Folder and uploading a File when %s is empty', async (_, inFolder) => {
    const room = seedDataRoom('Fresh');
    const path = inFolder
      ? `/data-rooms/${room.id}/folders/${seedFolder(room.id, 'Nothing here').id}`
      : `/data-rooms/${room.id}`;
    const { user } = renderApp(path);

    const emptyState = within(
      await screen.findByRole('region', { name: 'No files or folders yet' }),
    );
    await user.click(emptyState.getByRole('button', { name: 'Create Folder' }));
    expect(await screen.findByRole('dialog', { name: 'Create New Folder' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(emptyState.getByRole('button', { name: 'Upload File' }));
    expect(await screen.findByRole('dialog', { name: 'Upload PDF File' })).toBeInTheDocument();
  });

  it('switches between grid and list views and sorts the list by name, size and date', async () => {
    const { room } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}`);
    await waitFor(() => expect(gridNames('Files')).toHaveLength(3));

    await user.click(screen.getByRole('radio', { name: 'List view' }));
    expect(tableNames()).toEqual([
      'board minutes',
      'Contracts',
      'Budget',
      'Cap table',
      'term sheet',
    ]);

    await user.click(screen.getByRole('button', { name: 'File Size' }));
    expect(tableNames()).toEqual([
      'Cap table',
      'term sheet',
      'Budget',
      'board minutes',
      'Contracts',
    ]);

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(tableNames()).toEqual([
      'board minutes',
      'Budget',
      'Cap table',
      'Contracts',
      'term sheet',
    ]);

    // Seeded one after another, so the date order is the creation order.
    await user.click(screen.getByRole('button', { name: 'Date Modified' }));
    expect(tableNames()).toEqual([
      'Contracts',
      'board minutes',
      'term sheet',
      'Budget',
      'Cap table',
    ]);

    await user.click(screen.getByRole('radio', { name: 'Grid view' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(gridNames('Files')).toHaveLength(3);
  });

  it('shows a breadcrumb from the data room root and jumps up any number of levels', async () => {
    const { room, ndas } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}/folders/${ndas.id}`);

    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() =>
      expect(
        within(breadcrumb)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual(['Deals', 'Contracts', 'NDAs']),
    );
    expect(within(breadcrumb).getByText('NDAs')).toHaveAttribute('aria-current', 'page');

    await user.click(within(breadcrumb).getByRole('link', { name: 'Deals' }));
    await showsLevel('Deals');
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('goes back to the parent Folder, and from a top-level Folder to the root', async () => {
    const { room, ndas } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}/folders/${ndas.id}`);
    await showsLevel('NDAs');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await showsLevel('Contracts');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await showsLevel('Deals');
  });

  it('shows the sidebar tree with nested Folders that expand on demand', async () => {
    const { room } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}`);
    await showsLevel('Deals');

    await user.click(await tree().findByRole('button', { name: 'Expand Contracts' }));

    expect(await tree().findByText('NDAs')).toBeInTheDocument();
    expect(tree().getByText('msa')).toBeInTheDocument();
  });

  it('shows an error state with retry instead of an empty state when a level fails to load', async () => {
    const { room } = seedDeals();
    server.use(
      http.get(`${API_URL}/data-rooms/:id/contents`, () => HttpResponse.error(), { once: true }),
    );
    const { user } = renderApp(`/data-rooms/${room.id}`);

    const errors = await screen.findAllByRole('alert');
    expect(errors.map((e) => e.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Unable to connect')]),
    );
    expect(screen.queryByText('No files or folders yet')).not.toBeInTheDocument();
    // A read error is shown in place, never as a toast as well.
    expect(screen.queryAllByText(/Unable to connect/)).toHaveLength(errors.length);

    await user.click(main().getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(gridNames('Files')).toHaveLength(3));
  });

  it('shows a compact error with retry in a tree node that fails to load', async () => {
    const { room, contracts } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}`);
    await showsLevel('Deals');
    await tree().findByText('Contracts');
    server.use(
      http.get(
        `${API_URL}/data-rooms/:id/contents`,
        ({ request }) =>
          new URL(request.url).searchParams.get('folderId') === contracts.id
            ? apiError(500, 'INTERNAL', 'Internal server error')
            : undefined,
        { once: true },
      ),
    );

    await user.click(tree().getByRole('button', { name: 'Expand Contracts' }));

    const error = await tree().findByRole('alert');
    expect(error).toHaveTextContent('Something went wrong on our end');
    await user.click(within(error).getByRole('button', { name: 'Retry' }));
    expect(await tree().findByText('NDAs')).toBeInTheDocument();
  });

  it('says the data room is not found for one that is missing or not mine', async () => {
    renderApp('/data-rooms/someone-elses');
    await screen.findByRole('main');

    expect(await main().findByRole('alert')).toHaveTextContent('could not be found');
  });
});

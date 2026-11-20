import { screen, waitFor, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { renderApp, server } from '@/test/renderApp';
import { seedDataRoom, seedFile, seedFolder } from '@/test/fakeApi';
import { main, tree } from '@/test/screen';
import { API_URL } from '@/test/urls';

type User = ReturnType<typeof userEvent.setup>;

function seedDeals() {
  const room = seedDataRoom('Deals');
  const contracts = seedFolder(room.id, 'Contracts');
  const ndas = seedFolder(room.id, 'NDAs', contracts.id);
  seedFolder(room.id, 'Drafts', ndas.id);
  seedFile(room.id, 'Template', { folderId: ndas.id });
  seedFile(room.id, 'msa', { folderId: contracts.id });
  const board = seedFolder(room.id, 'Board');
  seedFile(room.id, 'Minutes', { folderId: board.id });
  seedFile(room.id, 'Budget');
  return { room, levels: { [contracts.id]: 'Contracts', [ndas.id]: 'NDAs', [board.id]: 'Board' } };
}

/** Records which levels of the data room, and how often the data rooms list, the app reads from the server. */
function recordReads(roomId: string, levels: Record<string, string>) {
  const reads = { levels: [] as string[], dataRoomList: 0 };
  const contentsPath = new URL(`${API_URL}/data-rooms/${roomId}/contents`).pathname;
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.pathname === contentsPath) {
      const folderId = url.searchParams.get('folderId');
      reads.levels.push(folderId ? levels[folderId] : 'Deals');
    } else if (url.href === `${API_URL}/data-rooms`) {
      reads.dataRoomList++;
    }
  });
  return reads;
}

const menuButton = (where: typeof main, name: string) =>
  where().getByRole('button', { name: `Actions for ${name}` });

async function rename(user: User, where: typeof main, from: string, to: string) {
  await user.click(menuButton(where, from));
  await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
  await user.clear(screen.getByLabelText('New Name'));
  await user.type(screen.getByLabelText('New Name'), to);
  await user.click(screen.getByRole('button', { name: 'Rename' }));
}

async function remove(user: User, name: string) {
  await user.click(menuButton(main, name));
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  await user.click(screen.getByRole('button', { name: 'Delete' }));
}

describe('Refreshing after a change', () => {
  /**
   * Loads the data rooms list, then opens Deals › Contracts › NDAs with every Folder open in the tree, so that each
   * level (Deals, Contracts, NDAs, Board) is on screen and a level marked out of date is read again at once.
   */
  async function setUp() {
    const { room, levels } = seedDeals();
    const { user } = renderApp('/');
    const card = await screen.findByRole('listitem', { name: 'Deals' });
    expect(card).toHaveTextContent('4 folders');
    await user.click(within(card).getByRole('link', { name: 'Open' }));
    await screen.findByRole('heading', { level: 1, name: 'Deals' });
    await user.click(await main().findByRole('button', { name: /^Contracts/ }));
    await user.click(await main().findByRole('button', { name: /^NDAs/ }));
    await main().findByText('Template');
    for (const folder of ['Contracts', 'NDAs', 'Board']) {
      await user.click(await tree().findByRole('button', { name: `Expand ${folder}` }));
    }
    await tree().findByText('Minutes');
    await tree().findByText('Drafts');
    return { user, reads: recordReads(room.id, levels) };
  }

  /**
   * Once the change is confirmed: checks which levels are read again, then goes back to the data rooms list and
   * checks whether it is read again. Returns the list's card for Deals.
   */
  async function expectReadAgain(
    user: User,
    reads: ReturnType<typeof recordReads>,
    message: string,
    expected: { levels: string[]; dataRoomList: boolean },
  ) {
    await screen.findByText(message);
    await waitFor(() => expect([...reads.levels].sort()).toEqual(expected.levels));

    await user.click(screen.getByRole('link', { name: /Data Room/ }));
    const card = await screen.findByRole('listitem', { name: 'Deals' });
    // A read starts as the list renders; give one that should not happen the chance to show up before checking.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect([...reads.levels].sort()).toEqual(expected.levels);
    expect(reads.dataRoomList > 0).toBe(expected.dataRoomList);
    return card;
  }

  it('reads again the level of a new Folder, the level showing its parent, and the data rooms list', async () => {
    const { user, reads } = await setUp();

    await user.click(main().getByRole('button', { name: 'New Folder' }));
    await user.type(screen.getByLabelText('Folder Name'), 'Signed');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    const card = await expectReadAgain(user, reads, 'Folder created successfully!', {
      levels: ['Contracts', 'NDAs'],
      dataRoomList: true,
    });
    await waitFor(() => expect(card).toHaveTextContent('5 folders'));
  });

  it('reads again the level of an uploaded File and the level showing its Folder', async () => {
    const { user, reads } = await setUp();

    await user.click(main().getByRole('button', { name: 'Upload File' }));
    await user.upload(
      screen.getByLabelText('PDF File'),
      new File(['%PDF-1.7 test'], 'Side letter.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await expectReadAgain(user, reads, 'File uploaded successfully!', {
      levels: ['Contracts', 'NDAs'],
      dataRoomList: false,
    });
  });

  it('reads again only the level of a renamed File', async () => {
    const { user, reads } = await setUp();

    await rename(user, main, 'Template', 'Mutual NDA');

    await expectReadAgain(user, reads, 'File renamed successfully!', {
      levels: ['NDAs'],
      dataRoomList: false,
    });
  });

  it('reads again every level that shows a renamed Folder: where it sits, its own and those below it', async () => {
    const { user, reads } = await setUp();

    await rename(user, tree, 'Contracts', 'Agreements');

    await expectReadAgain(user, reads, 'Folder renamed successfully!', {
      levels: ['Contracts', 'Deals', 'NDAs'],
      dataRoomList: false,
    });
  });

  it('reads again the level of a deleted File and the level showing its Folder', async () => {
    const { user, reads } = await setUp();

    await remove(user, 'Template');

    await expectReadAgain(user, reads, 'File deleted successfully!', {
      levels: ['Contracts', 'NDAs'],
      dataRoomList: false,
    });
  });

  it('reads again the level of a deleted Folder, the level showing its parent, and the data rooms list', async () => {
    const { user, reads } = await setUp();

    await remove(user, 'Drafts');

    const card = await expectReadAgain(user, reads, 'Folder deleted successfully!', {
      levels: ['Contracts', 'NDAs'],
      dataRoomList: true,
    });
    await waitFor(() => expect(card).toHaveTextContent('3 folders'));
  });
});

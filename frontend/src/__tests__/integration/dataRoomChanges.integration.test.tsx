import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, holdRequests } from '@/test/renderApp';
import { seedDataRoom, seedFile, seedFolder } from '@/test/fakeApi';
import { expectSingleToast, gridNames, main, tableNames, tree } from '@/test/screen';
import { API_URL } from '@/test/urls';

function seedDeals() {
  const room = seedDataRoom('Deals');
  const contracts = seedFolder(room.id, 'Contracts');
  const ndas = seedFolder(room.id, 'NDAs', contracts.id);
  const msa = seedFile(room.id, 'msa', { folderId: contracts.id });
  const budget = seedFile(room.id, 'Budget');
  return { room, contracts, ndas, msa, budget };
}

const showsLevel = (name: string) => screen.findByRole('heading', { level: 1, name });
const card = (name: string) => main().getByRole('button', { name: new RegExp(`^${name}`) });
const menuButton = (where: typeof main, name: string) =>
  where().getByRole('button', { name: `Actions for ${name}` });

describe('Changing a data room', () => {
  describe.each([
    ['the root', false],
    ['a Folder', true],
  ])('in %s', (_, inFolder) => {
    it('shows a new Folder at once, marked and inert until the server confirms it', async () => {
      const { room, contracts } = seedDeals();
      const release = holdRequests('post', `${API_URL}/folders`);
      const { user } = renderApp(
        inFolder ? `/data-rooms/${room.id}/folders/${contracts.id}` : `/data-rooms/${room.id}`,
      );
      await showsLevel(inFolder ? 'Contracts' : 'Deals');

      await user.click(main().getByRole('button', { name: 'New Folder' }));
      await user.type(screen.getByLabelText('Folder Name'), 'Appendix');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      expect(card('Appendix')).toBeDisabled();
      expect(card('Appendix')).toHaveTextContent('Creating...');
      expect(menuButton(main, 'Appendix')).toBeDisabled();
      fireEvent.contextMenu(card('Appendix'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      release();
      await waitFor(() => expect(card('Appendix')).toBeEnabled());
      await expectSingleToast('Folder created successfully!');
    });

    it('shows a renamed Folder and File under their new names at once', async () => {
      const { room, contracts } = seedDeals();
      const level = inFolder
        ? `/data-rooms/${room.id}/folders/${contracts.id}`
        : `/data-rooms/${room.id}`;
      const [folderName, fileName] = inFolder ? ['NDAs', 'msa'] : ['Contracts', 'Budget'];
      const { user } = renderApp(level);
      await showsLevel(inFolder ? 'Contracts' : 'Deals');
      await screen.findByRole('main');
      await main().findByText(fileName);

      for (const [name, type] of [
        [folderName, 'Folder'],
        [fileName, 'File'],
      ]) {
        const release = holdRequests('patch', `${API_URL}/*/:id/rename`);
        await user.click(menuButton(main, name));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
        const input = within(screen.getByRole('dialog', { name: `Rename ${type}` })).getByLabelText(
          'New Name',
        );
        expect(input).toHaveValue(name);
        await user.clear(input);
        await user.type(input, `${name} v2`);
        await user.click(screen.getByRole('button', { name: 'Rename' }));

        expect(main().getByText(`${name} v2`)).toBeInTheDocument();
        expect(main().queryByText(name)).not.toBeInTheDocument();
        release();
        await expectSingleToast(`${type} renamed successfully!`);
      }
    });

    it('removes a deleted Item at once, only after confirmation', async () => {
      const { room, contracts } = seedDeals();
      const [folderName, fileName] = inFolder ? ['NDAs', 'msa'] : ['Contracts', 'Budget'];
      const { user } = renderApp(
        inFolder ? `/data-rooms/${room.id}/folders/${contracts.id}` : `/data-rooms/${room.id}`,
      );
      await screen.findByRole('main');
      await main().findByText(fileName);

      await user.click(menuButton(main, fileName));
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      expect(screen.getByRole('alertdialog')).toHaveTextContent(
        `permanently delete the item "${fileName}"`,
      );
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(main().getByText(fileName)).toBeInTheDocument();

      const release = holdRequests('delete', `${API_URL}/folders/:id`);
      await user.click(menuButton(main, folderName));
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(main().queryByText(folderName)).not.toBeInTheDocument();
      release();
      await expectSingleToast('Folder deleted successfully!');
      expect(main().getByText(fileName)).toBeInTheDocument();
    });
  });

  it('shows an uploaded File in the current Folder as soon as the upload finishes', async () => {
    const { room, contracts } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}/folders/${contracts.id}`);
    await screen.findByRole('main');
    await main().findByText('msa');

    await user.click(main().getByRole('button', { name: 'Upload File' }));
    const pdf = new File(['%PDF-1.7 test'], 'Side letter.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('PDF File'), pdf);
    expect(screen.getByLabelText('File Name')).toHaveValue('Side letter');
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => expect(gridNames('Files')).toEqual(['msa', 'Side letter']));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await expectSingleToast('File uploaded successfully!');
  });

  it('rolls a rejected rename back and says why, once', async () => {
    const { room } = seedDeals();
    seedFolder(room.id, 'Board');
    const { user } = renderApp(`/data-rooms/${room.id}`);
    await screen.findByRole('main');
    await main().findByText('Board');
    // Hold the refetch that follows the failure, so only the rollback can restore the old name.
    holdRequests('get', `${API_URL}/data-rooms/:id/contents`);

    await user.click(menuButton(main, 'Board'));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    await user.clear(screen.getByLabelText('New Name'));
    await user.type(screen.getByLabelText('New Name'), 'Contracts');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    await expectSingleToast('A folder with this name already exists in this location');
    expect(gridNames('Folders')).toEqual(['Board', 'Contracts']);
  });

  it('rolls a rejected new Folder back', async () => {
    const { room } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}`);
    await screen.findByRole('main');
    await main().findByText('Contracts');
    holdRequests('get', `${API_URL}/data-rooms/:id/contents`);

    await user.click(main().getByRole('button', { name: 'New Folder' }));
    await user.type(screen.getByLabelText('Folder Name'), 'Contracts');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await expectSingleToast('A folder with this name already exists in this location');
    expect(gridNames('Folders')).toEqual(['Contracts']);
  });

  it('keeps the sidebar tree in step with creates, renames and deletes', async () => {
    const { room, contracts } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}/folders/${contracts.id}`);
    await showsLevel('Contracts');
    await user.click(await tree().findByRole('button', { name: 'Expand Contracts' }));
    await tree().findByText('NDAs');

    await user.click(main().getByRole('button', { name: 'New Folder' }));
    await user.type(screen.getByLabelText('Folder Name'), 'Appendix');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(tree().getByText('Appendix')).toBeInTheDocument();

    await user.click(menuButton(main, 'msa'));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    await user.clear(screen.getByLabelText('New Name'));
    await user.type(screen.getByLabelText('New Name'), 'Master agreement');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(tree().getByText('Master agreement')).toBeInTheDocument();

    await user.click(menuButton(main, 'NDAs'));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(tree().queryByText('NDAs')).not.toBeInTheDocument();
    await screen.findByText('Folder deleted successfully!');
    await waitFor(() => expect(tree().getByRole('button', { name: /^Appendix/ })).toBeEnabled());
  });

  it('renames the Folder on screen from the tree, updating the title and breadcrumb too', async () => {
    const { room, contracts } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}/folders/${contracts.id}`);
    await showsLevel('Contracts');

    await user.click(menuButton(tree, 'Contracts'));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    await user.clear(screen.getByLabelText('New Name'));
    await user.type(screen.getByLabelText('New Name'), 'Agreements');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    await showsLevel('Agreements');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Agreements')).toBeInTheDocument();
  });

  it('leaves a Folder deleted from the tree while it is on screen for its parent level', async () => {
    const { room, contracts, ndas } = seedDeals();
    const { user } = renderApp(`/data-rooms/${room.id}/folders/${ndas.id}`);
    await showsLevel('NDAs');
    await user.click(await tree().findByRole('button', { name: 'Expand Contracts' }));

    await user.click(menuButton(tree, 'Contracts'));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await showsLevel('Deals');
    await expectSingleToast('Folder deleted successfully!');
    expect(main().queryByText(contracts.name)).not.toBeInTheDocument();
  });

  describe('the Item menu', () => {
    const fileMenu = ['View', 'Rename', 'Delete'];
    const folderMenu = ['Rename', 'Delete'];
    const menuItems = () =>
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((item) => item.textContent);

    async function setUp(layout: 'grid' | 'list') {
      const { room } = seedDeals();
      const view = renderApp(`/data-rooms/${room.id}`);
      await screen.findByRole('main');
      await main().findByText('Budget');
      if (layout === 'list') {
        await view.user.click(screen.getByRole('radio', { name: 'List view' }));
        expect(tableNames()).toEqual(['Contracts', 'Budget']);
      }
      return view;
    }

    it.each(['grid', 'list'] as const)(
      'offers the same actions by button and by right-click in the %s view',
      async (layout) => {
        const { user } = await setUp(layout);

        await user.click(menuButton(main, 'Budget'));
        expect(menuItems()).toEqual(fileMenu);
        await user.keyboard('{Escape}');

        fireEvent.contextMenu(main().getByText('Contracts'));
        expect(await screen.findByRole('menu')).toBeInTheDocument();
        expect(menuItems()).toEqual(folderMenu);
      },
    );

    it('offers the same actions by button and by right-click in the folder tree', async () => {
      const { user } = await setUp('grid');
      await tree().findByText('Budget');

      await user.click(menuButton(tree, 'Contracts'));
      expect(menuItems()).toEqual(folderMenu);
      await user.keyboard('{Escape}');

      fireEvent.contextMenu(tree().getByText('Budget'));
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(menuItems()).toEqual(fileMenu);
    });
  });
});

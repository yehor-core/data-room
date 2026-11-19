import { expect, test, uniqueName } from './support/fixtures';
import { dataRoomUi } from './support/ui';

test('the owner builds nested folders and moves through them by tree and breadcrumb', async ({
  page,
  api,
}) => {
  const ui = dataRoomUi(page);
  const room = await api.createDataRoom(uniqueName('Navigation room'));
  await page.goto(`/data-rooms/${room.id}`);

  await ui.createFolder('Contracts');
  await ui.openFolder('Contracts');
  await expect(page.getByRole('heading', { name: 'Contracts' })).toBeVisible();

  await ui.createFolder('2024');
  await ui.openFolder('2024');
  await expect(page.getByRole('heading', { name: '2024' })).toBeVisible();
  await expect(ui.breadcrumb.getByText(room.name)).toBeVisible();
  await expect(ui.breadcrumb.getByText('Contracts')).toBeVisible();
  await expect(ui.breadcrumb.getByText('2024')).toBeVisible();

  // Up two levels at once.
  await ui.breadcrumb.getByRole('link', { name: room.name }).click();
  await expect(page.getByRole('heading', { name: room.name })).toBeVisible();
  await expect(ui.item('Contracts')).toBeVisible();

  // Straight to the deepest folder through the tree.
  await ui.tree.getByRole('button', { name: 'Contracts' }).click();
  await ui.tree.getByRole('button', { name: '2024' }).click();
  await expect(page.getByRole('heading', { name: '2024' })).toBeVisible();

  await ui.breadcrumb.getByRole('link', { name: 'Contracts' }).click();
  await expect(page.getByRole('heading', { name: 'Contracts' })).toBeVisible();
  await expect(ui.item('2024')).toBeVisible();
});

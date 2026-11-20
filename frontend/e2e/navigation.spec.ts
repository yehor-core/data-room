import { expect, test, uniqueName } from './support/fixtures';
import { dataRoomUi } from './support/ui';

test('the owner builds nested folders and moves through them by tree and breadcrumb', async ({
  page,
  api,
}) => {
  const ui = dataRoomUi(page);
  const room = await api.createDataRoom(uniqueName('Navigation room'));
  await page.goto(`/data-rooms/${room.id}`);
  await expect(ui.title(room.name)).toBeVisible();

  await ui.createFolder('Contracts');
  await ui.open('Contracts');
  await expect(ui.title('Contracts')).toBeVisible();

  await ui.createFolder('2024');
  await ui.open('2024');
  await expect(ui.title('2024')).toBeVisible();
  await expect(ui.breadcrumb).toHaveText(`${room.name}Contracts2024`);

  // Up two levels at once.
  await ui.breadcrumb.getByRole('link', { name: room.name }).click();
  await expect(ui.title(room.name)).toBeVisible();
  await expect(ui.item('Contracts')).toBeVisible();

  // Straight to the deepest folder through the tree.
  await ui.tree.getByRole('button', { name: 'Expand Contracts' }).click();
  await ui.tree.getByRole('button', { name: '2024', exact: true }).click();
  await expect(ui.title('2024')).toBeVisible();

  await ui.breadcrumb.getByRole('link', { name: 'Contracts' }).click();
  await expect(ui.title('Contracts')).toBeVisible();
  await expect(ui.item('2024')).toBeVisible();
});

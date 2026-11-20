import { pdf } from './support/files';
import { expect, isStored, test, uniqueName } from './support/fixtures';
import { dataRoomsListUi, dataRoomUi } from './support/ui';

test('the owner creates a data room and opens it', async ({ page }) => {
  const list = dataRoomsListUi(page);
  const name = uniqueName('Deal room');
  await page.goto('/');

  await list.create(name);
  await expect(list.room(name)).toBeVisible();

  await page.reload();
  await list.open(name);
  await expect(dataRoomUi(page).title(name)).toBeVisible();
  await expect(page.getByRole('region', { name: 'No files or folders yet' })).toBeVisible();
});

test('deleting a data room removes it with everything in it', async ({ page, api }) => {
  const list = dataRoomsListUi(page);
  const room = await api.createDataRoom(uniqueName('Doomed room'));
  const folder = await api.createFolder({ dataRoomId: room.id, name: 'Reports' });
  const file = await api.uploadFile({
    dataRoomId: room.id,
    folderId: folder.id,
    file: pdf('annual.pdf'),
  });
  await page.goto('/');

  await list.delete(room.name);
  await expect(list.room(room.name)).toBeHidden();

  await page.reload();
  await expect(list.heading).toBeVisible();
  await expect(list.room(room.name)).toBeHidden();
  expect(await api.status(`/data-rooms/${room.id}/contents`)).toBe(404);
  expect(await api.status(`/files/${file.id}/view`)).toBe(404);
  expect(await isStored(file.filePath)).toBe(false);
});

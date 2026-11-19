import { pdf } from './support/files';
import { expect, test, uniqueName } from './support/fixtures';
import { dataRoomsListUi, dataRoomUi } from './support/ui';
import { outsider } from './support/users';

test('another user can neither see nor open the owner’s data room, folders or files', async ({
  api,
  apiAs,
  openAs,
}) => {
  const room = await api.createDataRoom(uniqueName('Private room'));
  const folder = await api.createFolder({ dataRoomId: room.id, name: 'Board minutes' });
  const file = await api.uploadFile({
    dataRoomId: room.id,
    folderId: folder.id,
    file: pdf('minutes.pdf'),
  });
  const page = await openAs(outsider);
  const ui = dataRoomUi(page);

  await page.goto('/');
  await expect(dataRoomsListUi(page).heading).toBeVisible();
  await expect(page.getByText(room.name)).toBeHidden();

  await page.goto(`/data-rooms/${room.id}`);
  await expect(ui.errorMessage).toBeVisible();
  await expect(page.getByText(room.name)).toBeHidden();
  await expect(ui.item('Board minutes')).toBeHidden();

  await page.goto(`/data-rooms/${room.id}/folders/${folder.id}`);
  await expect(ui.errorMessage).toBeVisible();
  await expect(ui.item('minutes.pdf')).toBeHidden();

  const outsiderApi = await apiAs(outsider);
  expect(await outsiderApi.status(`/files/${file.id}/view`)).toBe(404);
});

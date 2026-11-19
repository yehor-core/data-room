import { pdf } from './support/files';
import { expect, test, uniqueName } from './support/fixtures';
import { dataRoomsListUi, dataRoomUi } from './support/ui';

test('a folder cannot take the name of a sibling folder', async ({ page, api }) => {
  const ui = dataRoomUi(page);
  const room = await api.createDataRoom(uniqueName('Conflict room'));
  await api.createFolder({ dataRoomId: room.id, name: 'Legal' });
  await page.goto(`/data-rooms/${room.id}`);

  await ui.createFolder('Legal');

  await expect(page.getByText(/already exists/i)).toBeVisible();
  await expect(ui.item('Legal')).toHaveCount(1);
});

test('a file cannot be renamed to the name of another file in the same folder', async ({
  page,
  api,
}) => {
  const ui = dataRoomUi(page);
  const room = await api.createDataRoom(uniqueName('Conflict room'));
  await api.uploadFile({ dataRoomId: room.id, file: pdf('budget.pdf') });
  await api.uploadFile({ dataRoomId: room.id, file: pdf('forecast.pdf') });
  await page.goto(`/data-rooms/${room.id}`);

  await ui.rename('forecast.pdf', 'budget.pdf');

  await expect(page.getByText(/already exists/i)).toBeVisible();
  await expect(ui.item('forecast.pdf')).toBeVisible();
  await expect(ui.item('budget.pdf')).toHaveCount(1);
});

test('a data room cannot take the name of another of the owner’s data rooms', async ({
  page,
  api,
}) => {
  const list = dataRoomsListUi(page);
  const room = await api.createDataRoom(uniqueName('Taken name'));
  await page.goto('/');

  await list.create(room.name);

  await expect(page.getByText(/already exists/i)).toBeVisible();
  await page.reload();
  await expect(list.room(room.name)).toHaveCount(1);
});

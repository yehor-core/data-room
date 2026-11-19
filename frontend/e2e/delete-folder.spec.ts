import { pdf } from './support/files';
import { expect, isStored, test, uniqueName } from './support/fixtures';
import { dataRoomUi } from './support/ui';

test('deleting a folder removes everything nested in it', async ({ page, api }) => {
  const ui = dataRoomUi(page);
  const room = await api.createDataRoom(uniqueName('Cleanup room'));
  const folder = await api.createFolder({ dataRoomId: room.id, name: 'Old deals' });
  const nested = await api.createFolder({
    dataRoomId: room.id,
    parentId: folder.id,
    name: '2019',
  });
  const files = [
    await api.uploadFile({ dataRoomId: room.id, folderId: folder.id, file: pdf('summary.pdf') }),
    await api.uploadFile({ dataRoomId: room.id, folderId: nested.id, file: pdf('closing.pdf') }),
  ];
  const kept = await api.uploadFile({ dataRoomId: room.id, file: pdf('keep-me.pdf') });
  await page.goto(`/data-rooms/${room.id}`);

  await ui.delete('Old deals');
  await expect(ui.item('Old deals')).toBeHidden();
  await expect(ui.item('keep-me.pdf')).toBeVisible();

  await page.goto(`/data-rooms/${room.id}/folders/${nested.id}`);
  await expect(ui.errorMessage).toBeVisible();
  await expect(ui.item('closing.pdf')).toBeHidden();

  for (const file of files) {
    expect(await api.status(`/files/${file.id}/view`)).toBe(404);
    expect(await isStored(file.filePath)).toBe(false);
  }
  expect(await isStored(kept.filePath)).toBe(true);
});

import { pdf } from './support/files';
import { expect, test, uniqueName } from './support/fixtures';
import { dataRoomUi } from './support/ui';

test('the owner renames a file and a folder', async ({ page, api }) => {
  const ui = dataRoomUi(page);
  const room = await api.createDataRoom(uniqueName('Rename room'));
  const folder = await api.createFolder({ dataRoomId: room.id, name: 'Drafts' });
  await api.uploadFile({ dataRoomId: room.id, folderId: folder.id, file: pdf('scan-001.pdf') });
  await page.goto(`/data-rooms/${room.id}`);

  await ui.rename('Drafts', 'Final');
  await expect(ui.item('Final')).toBeVisible();
  await expect(ui.item('Drafts')).toBeHidden();

  await ui.openFolder('Final');
  await ui.rename('scan-001.pdf', 'Signed NDA.pdf');
  await expect(ui.item('Signed NDA.pdf')).toBeVisible();
  await expect(ui.item('scan-001.pdf')).toBeHidden();

  // The server kept both names.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();
  await expect(ui.item('Signed NDA.pdf')).toBeVisible();
});

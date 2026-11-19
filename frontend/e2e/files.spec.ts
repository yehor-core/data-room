import { oversizedPdf, pdf, textFile } from './support/files';
import { expect, test, uniqueName } from './support/fixtures';
import { dataRoomUi } from './support/ui';

test('the owner uploads a PDF and opens it in a new tab', async ({ page, api, request }) => {
  const ui = dataRoomUi(page);
  const room = await api.createDataRoom(uniqueName('Upload room'));
  await page.goto(`/data-rooms/${room.id}`);

  await ui.upload(pdf('term-sheet.pdf'));
  await expect(ui.item('term-sheet.pdf')).toBeVisible();

  const opened = page.context().waitForEvent('page');
  await ui.itemAction('term-sheet.pdf', 'View');
  const tab = await opened;

  // The new tab loads the file from storage through a short-lived signed URL.
  await expect.poll(() => tab.url()).toContain('/storage/v1/object/sign/');
  const content = await request.get(tab.url());
  expect(content.status()).toBe(200);
  expect(content.headers()['content-type']).toBe('application/pdf');
  expect((await content.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test.describe('files the app does not accept', () => {
  test('a file that is not a PDF is refused before upload', async ({ page, api }) => {
    const ui = dataRoomUi(page);
    const room = await api.createDataRoom(uniqueName('Refusal room'));
    const uploads: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/files/upload')) uploads.push(request.url());
    });
    await page.goto(`/data-rooms/${room.id}`);

    await ui.upload(textFile('notes.txt'));

    await expect(page.getByText(/only pdf/i)).toBeVisible();
    await expect(ui.item('notes.txt')).toBeHidden();
    expect(uploads).toEqual([]);
  });

  test('a PDF over the size limit is refused before upload', async ({ page, api }) => {
    const ui = dataRoomUi(page);
    const room = await api.createDataRoom(uniqueName('Refusal room'));
    const uploads: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/files/upload')) uploads.push(request.url());
    });
    await page.goto(`/data-rooms/${room.id}`);

    await ui.upload(oversizedPdf('huge.pdf'));

    await expect(page.getByText(/4 MB/)).toBeVisible();
    await expect(ui.item('huge.pdf')).toBeHidden();
    expect(uploads).toEqual([]);
  });
});

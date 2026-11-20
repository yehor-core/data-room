import type { Page } from '@playwright/test';
import { oversizedPdf, pdf, textFile } from './support/files';
import { expect, test, uniqueName } from './support/fixtures';
import { dataRoomUi } from './support/ui';

test('the owner uploads a PDF and opens it in a new tab', async ({ page, api, request }) => {
  const ui = dataRoomUi(page);
  const room = await api.createDataRoom(uniqueName('Upload room'));
  await page.goto(`/data-rooms/${room.id}`);
  await expect(ui.title(room.name)).toBeVisible();

  await ui.upload(pdf('scan.pdf'), 'Term sheet.pdf');
  await expect(ui.item('Term sheet.pdf')).toBeVisible();

  const opened = page.context().waitForEvent('page');
  const signedUrlLoad = page
    .context()
    .waitForEvent('request', (request) => request.url().includes('/storage/v1/object/sign/'));
  await ui.open('Term sheet.pdf');
  const tab = await opened;

  // The new tab navigates to the file in storage through a short-lived signed URL. (Headless Chromium downloads
  // PDFs instead of showing them, so the request is checked rather than the tab's final URL.)
  const load = await signedUrlLoad;
  expect(load.isNavigationRequest()).toBe(true);
  expect(load.frame().page()).toBe(tab);
  const content = await request.get(load.url());
  expect(content.status()).toBe(200);
  expect(content.headers()['content-type']).toBe('application/pdf');
  expect((await content.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test.describe('files the app does not accept', () => {
  /** Upload requests the page sends from now on. */
  const watchUploads = (page: Page) => {
    const uploads: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/files/upload')) uploads.push(request.url());
    });
    return uploads;
  };

  test('a file that is not a PDF is refused before upload', async ({ page, api }) => {
    const ui = dataRoomUi(page);
    const room = await api.createDataRoom(uniqueName('Refusal room'));
    await page.goto(`/data-rooms/${room.id}`);
    await expect(ui.title(room.name)).toBeVisible();
    const uploads = watchUploads(page);

    await ui.pickFile(textFile('notes.txt'));

    await expect(page.getByText('Only PDF files are accepted.')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Upload' })).toBeDisabled();
    expect(uploads).toEqual([]);
  });

  test('a PDF over the size limit is refused before upload', async ({ page, api }) => {
    const ui = dataRoomUi(page);
    const room = await api.createDataRoom(uniqueName('Refusal room'));
    await page.goto(`/data-rooms/${room.id}`);
    await expect(ui.title(room.name)).toBeVisible();
    const uploads = watchUploads(page);

    await ui.pickFile(oversizedPdf('huge.pdf'));

    await expect(page.getByText('File is too large. The maximum size is 4 MB.')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Upload' })).toBeDisabled();
    expect(uploads).toEqual([]);
  });
});

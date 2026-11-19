import type { Page } from '@playwright/test';

type FilePayload = { name: string; mimeType: string; buffer: Buffer };

/** The data room screens as a user sees them: by role and accessible name only. */
export const dataRoomUi = (page: Page) => {
  const content = page.getByRole('main');
  const tree = page.getByRole('complementary');

  return {
    content,
    tree,
    breadcrumb: page.getByRole('navigation', { name: 'Breadcrumb' }),
    /** An Item (Folder or File) on the current level. */
    item: (name: string) => content.getByText(name, { exact: true }),
    errorMessage: page.getByRole('alert'),

    async openFolder(name: string) {
      await content.getByText(name, { exact: true }).click();
    },

    async itemAction(name: string, action: 'View' | 'Rename' | 'Delete') {
      await content.getByRole('button', { name: `Actions for ${name}` }).click();
      await page.getByRole('menuitem', { name: action }).click();
    },

    async createFolder(name: string) {
      await content
        .getByRole('button', { name: /new folder|create folder/i })
        .first()
        .click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('textbox').fill(name);
      await dialog.getByRole('button', { name: 'Create' }).click();
    },

    async rename(name: string, newName: string) {
      await this.itemAction(name, 'Rename');
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('textbox').fill(newName);
      await dialog.getByRole('button', { name: 'Rename' }).click();
    },

    async delete(name: string) {
      await this.itemAction(name, 'Delete');
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /delete|continue/i })
        .click();
    },

    async upload(file: FilePayload) {
      const chooser = page.waitForEvent('filechooser');
      await content
        .getByRole('button', { name: /upload/i })
        .first()
        .click();
      await (await chooser).setFiles(file);
    },
  };
};

export const dataRoomsListUi = (page: Page) => ({
  heading: page.getByRole('heading', { name: 'Data Rooms' }),
  /** A data room's link on the list. */
  room: (name: string) => page.getByRole('link', { name }),

  async create(name: string) {
    await page
      .getByRole('button', { name: /new data room|create data room/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill(name);
    await dialog.getByRole('button', { name: 'Create' }).click();
  },

  async delete(name: string) {
    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete|continue/i })
      .click();
  },
});

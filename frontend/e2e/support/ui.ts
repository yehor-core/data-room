import type { Page } from '@playwright/test';

type FilePayload = { name: string; mimeType: string; buffer: Buffer };

/** The data room screen (root and every Folder) as a user sees it: by role and accessible name only. */
export const dataRoomUi = (page: Page) => {
  const content = page.getByRole('main');
  const dialog = page.getByRole('dialog');

  const itemAction = async (name: string, action: 'View' | 'Rename' | 'Delete') => {
    await content.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: action }).click();
  };

  /** An Item (Folder or File) on the current level, in the grid view. */
  const item = (name: string) => content.getByRole('heading', { level: 3, name, exact: true });

  return {
    title: (name: string) => page.getByRole('heading', { level: 1, name, exact: true }),
    breadcrumb: page.getByRole('navigation', { name: 'Breadcrumb' }),
    tree: page.getByRole('navigation', { name: 'Folder tree' }),
    item,
    loadError: content.getByRole('alert'),
    itemAction,

    /** Opens a Folder on this screen, or a File in a new tab: a click on its card. */
    async open(name: string) {
      await item(name).click();
    },

    async createFolder(name: string) {
      await content.getByRole('button', { name: 'New Folder' }).click();
      await dialog.getByLabel('Folder Name').fill(name);
      await dialog.getByRole('button', { name: 'Create' }).click();
    },

    async rename(name: string, newName: string) {
      await itemAction(name, 'Rename');
      await dialog.getByLabel('New Name').fill(newName);
      await dialog.getByRole('button', { name: 'Rename' }).click();
    },

    async delete(name: string) {
      await itemAction(name, 'Delete');
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    },

    /** Opens the upload dialog and picks the file; the dialog stays open. */
    async pickFile(file: FilePayload) {
      // The toolbar's button; an empty level offers a second one further down.
      await content.getByRole('button', { name: 'Upload File' }).first().click();
      await dialog.getByLabel('PDF File').setInputFiles(file);
    },

    async upload(file: FilePayload, name: string) {
      await this.pickFile(file);
      await dialog.getByLabel('File Name').fill(name);
      await dialog.getByRole('button', { name: 'Upload' }).click();
    },
  };
};

export const dataRoomsListUi = (page: Page) => {
  const dialog = page.getByRole('dialog');
  return {
    heading: page.getByRole('heading', { level: 1, name: 'Data Rooms' }),
    /** A data room's card on the list. */
    room: (name: string) => page.getByRole('listitem', { name, exact: true }),

    async open(name: string) {
      await this.room(name).getByRole('link', { name: 'Open' }).click();
    },

    async create(name: string) {
      await page.getByRole('button', { name: 'New Data Room' }).click();
      await dialog.getByLabel('Name').fill(name);
      await dialog.getByRole('button', { name: 'Create' }).click();
    },

    async delete(name: string) {
      await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click();
    },
  };
};

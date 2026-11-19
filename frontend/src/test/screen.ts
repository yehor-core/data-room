// Queries for the data room screen, shared by the integration tests.
import { screen, within } from '@testing-library/react';

export const main = () => within(screen.getByRole('main'));
export const tree = () => within(screen.getByRole('navigation', { name: 'Folder tree' }));

/** Item names in the order a grid section ("Folders" or "Files") shows them. */
export const gridNames = (section: 'Folders' | 'Files') =>
  within(screen.getByRole('region', { name: section }))
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);

/** Item names in the order the list view's rows show them. */
export const tableNames = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

/** Waits for a toast with this text and checks that it is shown exactly once. */
export async function expectSingleToast(message: string) {
  await screen.findByText(message);
  expect(screen.getAllByText(message)).toHaveLength(1);
}

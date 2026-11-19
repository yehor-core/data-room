import { expect, test } from './support/fixtures';
import { createUser, freshUser, saveStorageState } from './support/users';

test('a user signing in for the first time lands on an empty data rooms list', async ({
  openAs,
}) => {
  const user = freshUser();
  await createUser(user);
  await saveStorageState(user);

  const page = await openAs(user);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Data Rooms' })).toBeVisible();
  await expect(page.getByText('No Data Rooms Yet')).toBeVisible();
});

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('the sign-in page sends the user to Google', async ({ page }) => {
    // Stop at Google's door: the e2e tests never sign in with a real Google account.
    await page.route('https://accounts.google.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Google sign-in</h1>' }),
    );

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('button', { name: /continue with google/i }).click();

    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
  });
});

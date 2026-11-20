import { expect, test as setup } from '@playwright/test';
import { BACKEND_URL } from './support/stack';
import { createUser, outsider, owner, saveStorageState } from './support/users';

// Real accounts in the local Supabase Auth and real sessions; the app has no test-only way in.
for (const user of [owner, outsider]) {
  setup(`sign in ${user.email}`, async ({ request }) => {
    await createUser(user);
    const { accessToken } = await saveStorageState(user);

    const me = await request.get(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(me.status()).toBe(200);
  });
}

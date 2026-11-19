import { startTestDatabase, TestDatabaseServer } from './postgres';

declare global {
  // eslint-disable-next-line no-var
  var testDatabase: TestDatabaseServer | undefined;
}

export default async function globalSetup() {
  globalThis.testDatabase = await startTestDatabase();
  process.env.DATABASE_URL = globalThis.testDatabase.url;
  process.env.DIRECT_URL = globalThis.testDatabase.url;
}

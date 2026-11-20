import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { migrateDeploy } from './db';

export interface TestDatabaseServer {
  /** Connection URL of a database with every migration applied. */
  url: string;
  stop(): Promise<void>;
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });

/**
 * Uses TEST_DATABASE_URL when it is set (CI service container, or a server
 * started with `npm run db:test`); otherwise starts a throwaway embedded Postgres.
 * Either way the database ends up with every migration applied.
 *
 * Imported only from Jest globalSetup and the db:test script: embedded-postgres is
 * ESM-only, which Jest's module runtime inside test files can't load.
 */
export async function startTestDatabase(
  options: { port?: number } = {},
): Promise<TestDatabaseServer> {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    await migrateDeploy(external);
    return { url: external, stop: async () => {} };
  }

  const databaseDir = await mkdtemp(path.join(tmpdir(), 'data-room-pg-'));
  const port = options.port ?? (await freePort());
  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    autoRehydrateSymlinks: true,
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('data_room_test');

  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/data_room_test`;
  await migrateDeploy(url);
  return {
    url,
    stop: async () => {
      await pg.stop();
      await rm(databaseDir, { recursive: true, force: true });
    },
  };
}

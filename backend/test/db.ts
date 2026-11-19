import { execFile } from 'node:child_process';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const backendDir = path.resolve(__dirname, '..');
const prismaBin = path.join(backendDir, 'node_modules', '.bin', 'prisma');
export const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');

export function runPrisma(args: string[], databaseUrl: string) {
  return promisify(execFile)(prismaBin, args, {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
  });
}

export const migrateDeploy = (databaseUrl: string, schema = schemaPath) =>
  runPrisma(['migrate', 'deploy', '--schema', schema], databaseUrl);

/** Applies the migrations up to and including `lastMigration`, as a database deployed at that point would have. */
export async function migrateDeployUpTo(databaseUrl: string, lastMigration: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'data-room-migrations-'));
  try {
    const migrations = path.join(path.dirname(schemaPath), 'migrations');
    await cp(schemaPath, path.join(dir, 'schema.prisma'));
    await cp(path.join(migrations, 'migration_lock.toml'), path.join(dir, 'migrations', 'migration_lock.toml'));
    for (const name of (await readdir(migrations)).sort()) {
      if (name === 'migration_lock.toml' || name > lastMigration) continue;
      await cp(path.join(migrations, name), path.join(dir, 'migrations', name), { recursive: true });
    }
    await migrateDeploy(databaseUrl, path.join(dir, 'schema.prisma'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Creates an empty database on the same server as `serverUrl` and returns its URL. */
export async function createEmptyDatabase(serverUrl: string, name: string) {
  const admin = new PrismaClient({ datasourceUrl: serverUrl });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

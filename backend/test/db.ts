import { execFile } from 'node:child_process';
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

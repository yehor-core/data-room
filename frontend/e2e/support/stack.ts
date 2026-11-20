import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** Where the app under test is served. The local Supabase config allows redirects to the frontend URL. */
export const FRONTEND_URL = 'http://localhost:3100';
export const BACKEND_URL = 'http://localhost:3101';

/** The bucket the backend's Supabase storage adapter writes to. */
export const STORAGE_BUCKET = 'data-room-files';

export interface LocalSupabase {
  apiUrl: string;
  dbUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

const REPO_ROOT = path.resolve(__dirname, '../../..');

const ENV_NAMES: Record<keyof LocalSupabase, string> = {
  apiUrl: 'E2E_SUPABASE_URL',
  dbUrl: 'E2E_SUPABASE_DB_URL',
  anonKey: 'E2E_SUPABASE_ANON_KEY',
  serviceRoleKey: 'E2E_SUPABASE_SERVICE_ROLE_KEY',
};

/**
 * Reads the URLs and keys of the running local Supabase stack from `supabase status`, once per run: the values are
 * put into the environment, which Playwright's workers inherit. Returns null when the stack is not running.
 */
export function loadLocalSupabase(): LocalSupabase | null {
  const loaded = readFromEnv();
  if (loaded) return loaded;

  let status: Record<string, string>;
  try {
    status = parseStatus(runStatus());
  } catch {
    return null;
  }
  const supabase: LocalSupabase = {
    apiUrl: status.API_URL,
    dbUrl: status.DB_URL,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  };
  for (const [key, name] of Object.entries(ENV_NAMES)) {
    process.env[name] = supabase[key as keyof LocalSupabase];
  }
  return readFromEnv();
}

/** The local Supabase stack, for test code. Playwright's config has loaded it before any test runs. */
export function localSupabase(): LocalSupabase {
  const supabase = readFromEnv();
  if (!supabase) {
    throw new Error(
      'Local Supabase is not running. Start the whole e2e environment with `npm run test:e2e`.',
    );
  }
  return supabase;
}

function readFromEnv(): LocalSupabase | null {
  const entries = Object.entries(ENV_NAMES).map(([key, name]) => [key, process.env[name]]);
  if (entries.some(([, value]) => !value)) return null;
  return Object.fromEntries(entries) as LocalSupabase;
}

function runStatus(): string {
  // The experimental stack (`SUPABASE_EXPERIMENTAL_STACK=1`, runs without Docker) only prints JSON via `--env`.
  const args = process.env.SUPABASE_EXPERIMENTAL_STACK
    ? ['status', '--env', '--workdir', REPO_ROOT]
    : ['status', '-o', 'env', '--workdir', REPO_ROOT];
  return execFileSync('supabase', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Accepts both `KEY="value"` lines and a flat JSON object. */
function parseStatus(output: string): Record<string, string> {
  const trimmed = output.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  return Object.fromEntries(
    trimmed
      .split('\n')
      .map((line) => /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim()))
      .filter((match): match is RegExpExecArray => match !== null)
      .map(([, name, value]) => [name, value]),
  );
}

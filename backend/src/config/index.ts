import dotenv from 'dotenv';

dotenv.config();

// DATABASE_URL is read by Prisma itself, not through this module, but the app can't start without it.
const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ALLOWED_ORIGINS'] as const;

/** Validates the environment once and returns it parsed. Every module reads its settings from here. */
export function loadConfig(env: NodeJS.ProcessEnv) {
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    supabaseUrl: env.SUPABASE_URL!,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY!,
    allowedOrigins: env.ALLOWED_ORIGINS!.split(',').map((origin) => origin.trim()),
    port: Number(env.PORT ?? 3001),
    nodeEnv: env.NODE_ENV ?? 'development',
  };
}

export const config = loadConfig(process.env);

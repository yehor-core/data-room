import { createSupabaseAdapters } from './adapters/supabase';
import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import prisma from './lib/prisma';

const app = createApp({
  db: prisma,
  ...createSupabaseAdapters({
    url: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
  }),
  logger,
  config,
});

// On Vercel the exported app is the serverless function; anywhere else, run a server.
if (config.nodeEnv !== 'production') {
  app.listen(config.port, () =>
    logger.info(`Server running on port ${config.port} (${config.nodeEnv})`),
  );
}

export default app;

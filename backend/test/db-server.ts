import { logger } from '../src/lib/logger';
import { startTestDatabase } from './postgres';

const port = Number(process.env.TEST_DB_PORT ?? 54329);

startTestDatabase({ port }).then(
  (db) => {
    logger.info(
      `Test database is ready, all migrations applied.\nTEST_DATABASE_URL=${db.url}\nPress Ctrl+C to stop.`,
    );
    const stop = () => db.stop().then(() => process.exit(0));
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  },
  (error) => {
    logger.error(error);
    process.exit(1);
  },
);

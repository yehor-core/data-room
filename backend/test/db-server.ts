import { startTestDatabase } from './postgres';

const port = Number(process.env.TEST_DB_PORT ?? 54329);

startTestDatabase({ port }).then(
  (db) => {
    console.log(`Test database is ready, all migrations applied.\nTEST_DATABASE_URL=${db.url}\nPress Ctrl+C to stop.`);
    const stop = () => db.stop().then(() => process.exit(0));
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

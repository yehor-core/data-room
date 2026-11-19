import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { Logger } from './lib/logger';
import { FileStorage, TokenVerifier } from './ports';
import { authenticate } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errorHandler';
import { createDataRoomAccess } from './access/dataRoomAccess';
import { AccessFor } from './routes/accessFor';
import { dataRoomRoutes } from './routes/dataRooms';
import { fileRoutes } from './routes/files';
import { folderRoutes } from './routes/folders';
import { route } from './routes/route';

export interface AppDependencies {
  db: PrismaClient;
  storage: FileStorage;
  tokenVerifier: TokenVerifier;
  logger: Logger;
  config: { allowedOrigins: string[] };
}

export function createApp({ db, storage, tokenVerifier, logger, config }: AppDependencies) {
  const accessFor: AccessFor = (req) => createDataRoomAccess({ db, storage, logger }, req.user.id);

  const app = express();

  // Trust only Vercel's proxy so rate limiting sees the client IP
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.allowedOrigins }));
  app.use(morgan('combined', { stream: { write: (line) => logger.info(line.trimEnd()) } }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'OK' } });
  });

  app.use('/api', authenticate({ db, tokenVerifier }));
  app.get('/api/auth/me', route(async (req) => req.user));
  app.use('/api/data-rooms', dataRoomRoutes(accessFor));
  app.use('/api/folders', folderRoutes(accessFor));
  app.use('/api/files', fileRoutes(accessFor));

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}

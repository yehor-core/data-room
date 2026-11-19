import { RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../errors';
import { TokenVerifier } from '../ports';
import { AuthenticatedRequest, userSelect } from '../types';

/** Verifies the bearer token and finds or creates its user. Mounted once, in front of every /api route. */
export const authenticate =
  ({ db, tokenVerifier }: { db: PrismaClient; tokenVerifier: TokenVerifier }): RequestHandler =>
  (req, _res, next) => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!token) return next(new AppError('UNAUTHENTICATED', 'Access token required'));

    tokenVerifier
      .verify(token)
      .then(async (identity) => {
        if (!identity) throw new AppError('UNAUTHENTICATED', 'Invalid or expired token');
        (req as AuthenticatedRequest).user = await db.user.upsert({
          where: { email: identity.email },
          update: {},
          create: { email: identity.email, name: identity.name ?? identity.email.split('@')[0] },
          select: userSelect,
        });
        next();
      })
      .catch(next);
  };

import { Request, RequestHandler } from 'express';
import { AuthenticatedRequest } from '../types';

/**
 * Adapts an async handler to Express: its result is sent in the success envelope with `status`,
 * `undefined` becomes 204 with no body, and a thrown error goes to the error handler.
 */
export const route =
  (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler =>
  (req: Request, res, next) => {
    handler(req as AuthenticatedRequest)
      .then((data) =>
        data === undefined
          ? res.status(204).end()
          : res.status(status).json({ success: true, data }),
      )
      .catch(next);
  };

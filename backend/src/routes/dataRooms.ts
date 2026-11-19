import { Router } from 'express';
import { query } from 'express-validator';
import { nameRule, optionalId, validate } from '../middleware/validate';
import { AccessFor } from './accessFor';
import { route } from './route';

export function dataRoomRoutes(accessFor: AccessFor) {
  const router = Router();

  router.get('/', route((req) => accessFor(req).dataRooms.list()));

  router.post('/', validate(nameRule(3, 100)), route((req) => accessFor(req).dataRooms.create(req.body.name), 201));

  router.get(
    '/:id/contents',
    validate(optionalId('folderId', query)),
    route((req) => accessFor(req).contents(req.params.id, (req.query.folderId as string) || undefined)),
  );

  router.delete('/:id', route((req) => accessFor(req).dataRooms.delete(req.params.id)));

  return router;
}

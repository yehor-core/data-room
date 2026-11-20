import { Router } from 'express';
import { nameRule, optionalId, requiredId, validate } from '../middleware/validate';
import { AccessFor } from './accessFor';
import { route } from './route';

export function folderRoutes(accessFor: AccessFor) {
  const router = Router();

  router.post(
    '/',
    validate(nameRule('folder'), requiredId('dataRoomId'), optionalId('parentId')),
    route((req) => {
      const { name, dataRoomId, parentId } = req.body;
      return accessFor(req).folders.create({ name, dataRoomId, parentId });
    }, 201),
  );

  router.patch(
    '/:id/rename',
    validate(nameRule('folder')),
    route((req) => accessFor(req).folders.rename(req.params.id, req.body.name)),
  );

  router.delete(
    '/:id',
    route((req) => accessFor(req).folders.delete(req.params.id)),
  );

  return router;
}

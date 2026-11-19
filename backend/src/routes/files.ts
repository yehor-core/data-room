import { RequestHandler, Router } from 'express';
import { check } from 'express-validator';
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../access/uploads';
import { nameRule, optionalId, requiredId, validate } from '../middleware/validate';
import { AccessFor } from './accessFor';
import { route } from './route';

// Busboy rejects a file once it reaches `fileSize` bytes, so one byte more lets a file of exactly the limit through.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES + 1, files: 1 } });

const nameDefaultsToFileName: RequestHandler = (req, _res, next) => {
  req.body.name ||= req.file?.originalname;
  next();
};

export function fileRoutes(accessFor: AccessFor) {
  const router = Router();

  router.post(
    '/upload',
    upload.single('file'),
    nameDefaultsToFileName,
    validate(
      check('file')
        .custom((_value, { req }) => Boolean(req.file))
        .withMessage('A file is required'),
      requiredId('dataRoomId'),
      optionalId('folderId'),
      nameRule(1, 255),
    ),
    route((req) => {
      const file = req.file!;
      const { dataRoomId, folderId, name } = req.body;
      return accessFor(req).files.upload({
        dataRoomId,
        folderId: folderId || undefined,
        name,
        mimeType: file.mimetype,
        content: file.buffer,
      });
    }, 201),
  );

  router.patch(
    '/:id/rename',
    validate(nameRule(1, 255)),
    route((req) => accessFor(req).files.rename(req.params.id, req.body.name)),
  );

  router.get('/:id/view', route((req) => accessFor(req).files.viewLink(req.params.id)));

  router.delete('/:id', route((req) => accessFor(req).files.delete(req.params.id)));

  return router;
}

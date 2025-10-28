import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import asyncHandler from 'express-async-handler';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import createError from 'http-errors';
import { uploadFile, deleteFile as deleteSupabaseFile, getSignedUrl } from '../utils/supabase';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { dataRoomId, folderId } = req.query;
    const userId = req.user?.id;

    if (!dataRoomId && !folderId) {
        return next(createError(400, 'Either dataRoomId or folderId is required'));
    }

    const where: {
        userId: string | undefined;
        dataRoomId?: string;
        folderId?: string;
    } = { userId };

    if (folderId) {
        where.folderId = folderId as string;
    } else if (dataRoomId) {
        where.dataRoomId = dataRoomId as string;
    }

    const files = await prisma.file.findMany({
        where,
        orderBy: {
            createdAt: 'desc',
        },
    });

    res.status(200).json({
        success: true,
        data: files,
    });
}));

router.get('/:id/view', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.id;

    const file = await prisma.file.findFirst({
        where: { id, userId },
    });

    if (!file) {
        return next(createError(404, 'File not found'));
    }

    if (!file.filePath) {
        return next(createError(500, 'File path not available'));
    }

    const signedUrl = await getSignedUrl(file.filePath);
    res.redirect(signedUrl);
}));

router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { dataRoomId, folderId, name } = req.body;
    const file = req.file;

    if (!userId) {
        return next(createError(401, 'User not authenticated'));
    }

    if (!file) {
      return next(createError(400, 'No file uploaded'));
    }

    if (!dataRoomId) {
        return next(createError(400, 'dataRoomId is required'));
    }

    try {
      const finalName = name || file.originalname;
      const filePath = await uploadFile(file.buffer, finalName, `uploads/${userId}`);

      const newFile = await prisma.file.create({
        data: {
          name: finalName,
          dataRoomId,
          folderId: folderId || null,
          userId,
          fileSize: BigInt(file.size),
          mimeType: file.mimetype,
          filePath,
        },
      });

      res.status(201).json(newFile);
    } catch (error) {
      console.error('File upload error:', error);
      next(createError(500, 'Failed to upload file'));
    }
  })
);

router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const file = await prisma.file.findFirst({
    where: { id, userId },
  });

  if (!file) {
    return next(createError(404, 'File not found'));
  }
  
  if (file.filePath) {
      await deleteSupabaseFile(file.filePath);
  }

  await prisma.file.delete({
    where: { id },
  });

  res.status(204).send();
}));

export default router;

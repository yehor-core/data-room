import { Router, Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types';
import { uploadFile, deleteFile as deleteSupabaseFile } from '../utils/supabase';

const router = Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

// Helper function to serialize BigInt fields to strings for JSON
const serializeFile = (file: any) => ({
  ...file,
  fileSize: file.fileSize ? file.fileSize.toString() : null,
});

const serializeFiles = (files: any[]) => files.map(serializeFile);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed') as any, false);
    }
  },
});

// Validation middleware
const validateCreateFile = [
  body('name').isString().trim().isLength({ min: 1, max: 255 }),
  body('folderId').isUUID(),
];

const validateUpdateFile = [
  body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
];

// Get files in a folder
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { folderId, dataRoomId, page = 1, limit = 20 } = req.query;

  if (!folderId && !dataRoomId) {
    throw createError('Either folderId or dataRoomId is required', 400);
  }

  const skip = (Number(page) - 1) * Number(limit);

  let whereClause: any = {};

  if (folderId) {
    // Verify folder exists and user has access
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId as string,
        dataRoom: {
          ownerId: req.user!.id,
        },
      },
    });

    if (!folder) {
      throw createError('Folder not found', 404);
    }

    whereClause.folderId = folderId;
  } else if (dataRoomId) {
    // Verify data room exists and user has access
    const dataRoom = await prisma.dataRoom.findFirst({
      where: {
        id: dataRoomId as string,
        ownerId: req.user!.id,
      },
    });

    if (!dataRoom) {
      throw createError('Data room not found', 404);
    }

    whereClause.folder = {
      dataRoomId: dataRoomId as string,
    };
  }

  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where: whereClause,
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            dataRoomId: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take: Number(limit),
    }),
    prisma.file.count({
      where: whereClause,
    }),
  ]);

  res.json({
    success: true,
    data: serializeFiles(files),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
}));

// Get a specific file
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const file = await prisma.file.findFirst({
    where: {
      id,
      folder: {
        dataRoom: {
          ownerId: req.user!.id,
        },
      },
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
          dataRoomId: true,
        },
      },
    },
  });

  if (!file) {
    throw createError('File not found', 404);
  }

  res.json({
    success: true,
    data: serializeFile(file),
  });
}));

// Multer error handler middleware
const handleMulterError = (err: any, req: Request, res: Response, next: any): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'File size exceeds 50MB limit',
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
    return;
  } else if (err) {
    res.status(400).json({
      success: false,
      error: err.message || 'File upload failed',
    });
    return;
  }
  next();
};

// Upload a new file
router.post('/upload', upload.single('file'), handleMulterError, validateCreateFile, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400);
  }

  if (!req.file) {
    throw createError('No file uploaded', 400);
  }

  const { name, folderId } = req.body;

  // Verify folder exists and user has access
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      dataRoom: {
        ownerId: req.user!.id,
      },
    },
  });

  if (!folder) {
    throw createError('Folder not found', 404);
  }

  // Check if file with same name already exists in the folder
  const existingFile = await prisma.file.findFirst({
    where: {
      name,
      folderId,
    },
  });

  if (existingFile) {
    throw createError('File with this name already exists in this folder', 409);
  }

  try {
    // Upload file to Supabase Storage
    const filePath = await uploadFile(req.file.buffer, req.file.originalname);

    // Save file metadata to database
    const file = await prisma.file.create({
      data: {
        name,
        mimeType: req.file.mimetype,
        fileSize: BigInt(req.file.size),
        folderId,
        dataRoomId: folder.dataRoomId,
        userId: req.user!.id,
        filePath,
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            dataRoomId: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: serializeFile(file),
      message: 'File uploaded successfully',
    });
  } catch (error) {
    throw createError(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
}));

// Update a file
router.put('/:id', validateUpdateFile, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400);
  }

  const { id } = req.params;
  const { name } = req.body;

  // Verify file exists and user has access
  const existingFile = await prisma.file.findFirst({
    where: {
      id,
      folder: {
        dataRoom: {
          ownerId: req.user!.id,
        },
      },
    },
  });

  if (!existingFile) {
    throw createError('File not found', 404);
  }

  // Check if new name conflicts with existing file in same folder
  if (name && name !== existingFile.name) {
    const conflictingFile = await prisma.file.findFirst({
      where: {
        name,
        folderId: existingFile.folderId,
        id: { not: id },
      },
    });

    if (conflictingFile) {
      throw createError('File with this name already exists in this folder', 409);
    }
  }

  const file = await prisma.file.update({
    where: { id },
    data: {
      ...(name && { name }),
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
          dataRoomId: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: serializeFile(file),
    message: 'File updated successfully',
  });
}));

// Delete a file
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  // Verify file exists and user has access
  const file = await prisma.file.findFirst({
    where: {
      id,
      folder: {
        dataRoom: {
          ownerId: req.user!.id,
        },
      },
    },
  });

  if (!file) {
    throw createError('File not found', 404);
  }

  try {
    // Delete file from Supabase Storage
    if (file.filePath) {
      const fileName = file.filePath.split('/').pop();
      if (fileName) {
        await deleteSupabaseFile(fileName);
      }
    }

    // Delete file record from database
    await prisma.file.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    throw createError(`File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
}));

// Search files
router.get('/search', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { 
    query: searchQuery, 
    dataRoomId, 
    folderId, 
    fileType, 
    dateFrom, 
    dateTo, 
    sizeMin, 
    sizeMax,
    page = 1,
    limit = 20
  } = req.query;

  if (!searchQuery) {
    throw createError('Search query is required', 400);
  }

  const skip = (Number(page) - 1) * Number(limit);

  let whereClause: any = {
    name: {
      contains: searchQuery as string,
      mode: 'insensitive',
    },
    folder: {
      dataRoom: {
        ownerId: req.user!.id,
      },
    },
  };

  if (dataRoomId) {
    whereClause.folder.dataRoomId = dataRoomId;
  }

  if (folderId) {
    whereClause.folderId = folderId;
  }

  if (fileType) {
    whereClause.mimeType = fileType;
  }

  if (dateFrom || dateTo) {
    whereClause.createdAt = {};
    if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom as string);
    if (dateTo) whereClause.createdAt.lte = new Date(dateTo as string);
  }

  if (sizeMin || sizeMax) {
    whereClause.fileSize = {};
    if (sizeMin) whereClause.fileSize.gte = BigInt(sizeMin as string);
    if (sizeMax) whereClause.fileSize.lte = BigInt(sizeMax as string);
  }

  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where: whereClause,
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            dataRoomId: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      skip,
      take: Number(limit),
    }),
    prisma.file.count({
      where: whereClause,
    }),
  ]);

  res.json({
    success: true,
    data: serializeFiles(files),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
}));

export { router as fileRoutes };

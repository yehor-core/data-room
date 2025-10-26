import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { setCorsHeaders, handlePreflight } from '../src/config/cors';

// Inline authentication middleware
const authenticateToken = (req: VercelRequest): string | null => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  console.log('[Folders API] Auth header:', authHeader ? 'Present' : 'Missing');
  console.log('[Folders API] JWT Secret available:', !!process.env.JWT_SECRET);

  if (!token) {
    console.log('[Folders API] No token found in authorization header');
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    console.log('[Folders API] Token decoded successfully for user:', decoded.userId);
    return decoded.userId;
  } catch (error) {
    console.error('[Folders API] Token verification failed:', error);
    return null;
  }
};

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Test database connection
prisma.$connect().catch((error) => {
  console.error('[Folders API] Database connection failed:', error);
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log(`[Folders API] ${req.method} ${req.url}`, {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      query: req.query,
      body: req.body
    });

    setCorsHeaders(res, req.headers.origin);

    if (req.method === 'OPTIONS') {
      console.log('[Folders API] Handling OPTIONS preflight');
      handlePreflight(req, res);
      return;
    }

    const userId = authenticateToken(req);
    if (!userId) {
      console.log('[Folders API] Authentication failed');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log(`[Folders API] Authenticated user: ${userId}`);
    
    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('[Folders API] Database connection successful');
    } catch (dbError) {
      console.error('[Folders API] Database connection failed:', dbError);
      setCorsHeaders(res, req.headers.origin);
      res.status(500).json({ 
        error: 'Database connection failed',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error'
      });
      return;
    }
  } catch (error) {
    console.error('[Folders API] Error in handler setup:', error);
    setCorsHeaders(res, req.headers.origin);
    res.status(500).json({ error: 'Internal server error during setup' });
    return;
  }

  const { id, action } = req.query;

  try {
    if (req.method === 'POST' && !id) {
      // Create a new folder
      const { name, dataRoomId, parentId } = req.body;

      if (!name || !dataRoomId) {
        res.status(400).json({ error: 'Name and dataRoomId are required' });
        return;
      }

      // Verify the user owns the data room
      const dataRoom = await prisma.dataRoom.findFirst({
        where: { 
          id: dataRoomId,
          ownerId: userId 
        }
      });

      if (!dataRoom) {
        res.status(404).json({ error: 'Data room not found' });
        return;
      }

      // Check for duplicate folder name in same parent
      const existingFolder = await prisma.folder.findFirst({
        where: {
          name,
          dataRoomId,
          parentId: parentId || null,
        }
      });

      if (existingFolder) {
        res.status(409).json({ error: 'A folder with this name already exists in this location' });
        return;
      }

      const folder = await prisma.folder.create({
        data: {
          name,
          dataRoomId,
          parentId: parentId || null,
          userId: userId,
        },
        include: {
          _count: {
            select: { 
              files: true,
              children: true 
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        data: folder,
        message: 'Folder created successfully'
      });

    } else if (req.method === 'GET' && id && typeof id === 'string' && !action) {
      // Get specific folder with its contents
      const folder = await prisma.folder.findFirst({
        where: { 
          id,
          dataRoom: {
            ownerId: userId
          }
        },
        include: {
          parent: {
            select: {
              id: true,
              name: true
            }
          },
          children: {
            include: {
              _count: {
                select: { 
                  files: true,
                  children: true 
                }
              }
            }
          },
          files: true
        }
      });

      if (!folder) {
        res.status(404).json({ error: 'Folder not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: folder
      });

    } else if (req.method === 'POST' && id && typeof id === 'string' && action === 'duplicate') {
      // Duplicate folder
      const folder = await prisma.folder.findFirst({
        where: { 
          id,
          dataRoom: {
            ownerId: userId
          }
        },
        include: {
          files: true,
          children: true
        }
      });

      if (!folder) {
        res.status(404).json({ error: 'Folder not found' });
        return;
      }

      // Create duplicate folder
      const duplicateFolder = await prisma.folder.create({
        data: {
          name: `${folder.name} (Copy)`,
          dataRoomId: folder.dataRoomId,
          parentId: folder.parentId,
          userId: userId,
        }
      });

      res.status(201).json({
        success: true,
        data: duplicateFolder,
        message: 'Folder duplicated successfully'
      });

    } else if (req.method === 'PATCH' && id && typeof id === 'string') {
      // Update folder
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const folder = await prisma.folder.findFirst({
        where: { 
          id,
          dataRoom: {
            ownerId: userId
          }
        }
      });

      if (!folder) {
        res.status(404).json({ error: 'Folder not found' });
        return;
      }

      const updatedFolder = await prisma.folder.update({
        where: { id },
        data: { name },
        include: {
          _count: {
            select: { 
              files: true,
              children: true 
            }
          }
        }
      });

      res.status(200).json({
        success: true,
        data: updatedFolder,
        message: 'Folder updated successfully'
      });

    } else if (req.method === 'DELETE' && id && typeof id === 'string') {
      // Delete folder
      console.log(`[Folders API] Deleting folder: ${id} for user: ${userId}`);
      
      const folder = await prisma.folder.findFirst({
        where: { 
          id,
          dataRoom: {
            ownerId: userId
          }
        }
      });

      if (!folder) {
        console.log(`[Folders API] Folder not found: ${id}`);
        res.status(404).json({ error: 'Folder not found' });
        return;
      }

      console.log(`[Folders API] Found folder to delete: ${folder.name}`);
      
      await prisma.folder.delete({
        where: { id }
      });

      console.log(`[Folders API] Successfully deleted folder: ${id}`);
      res.status(200).json({
        success: true,
        message: 'Folder deleted successfully'
      });

    } else if (action === 'files' && id && typeof id === 'string') {
      // Get files for a folder
      const files = await prisma.file.findMany({
        where: { 
          folderId: id,
          folder: {
            dataRoom: {
              ownerId: userId
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({
        success: true,
        data: files
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[Folders API] Error in main handler:', error);
    console.error('[Folders API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      method: req.method,
      url: req.url,
      query: req.query
    });
    
    // Ensure CORS headers are set even on error
    setCorsHeaders(res, req.headers.origin);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

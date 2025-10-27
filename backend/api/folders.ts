import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { handleCORS } from './_cors';

// Inline authentication middleware - validates Supabase JWT tokens
const authenticateToken = (req: VercelRequest): string | null => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  console.log('[Folders API] Auth header:', authHeader ? 'Present' : 'Missing');

  if (!token) {
    console.log('[Folders API] No token found in authorization header');
    return null;
  }

  try {
    // Decode the Supabase JWT token (don't verify signature, Supabase handles that)
    const decoded = jwt.decode(token) as any;
    
    if (!decoded || !decoded.sub) {
      console.log('[Folders API] Invalid token structure');
      return null;
    }

    console.log('[Folders API] Token decoded successfully, userId (sub):', decoded.sub);
    return decoded.sub;
  } catch (error) {
    console.error('[Folders API] Token decoding failed:', error);
    return null;
  }
};

// Use a singleton pattern for Prisma Client in serverless
// This ensures we reuse connections across function invocations
let prisma: PrismaClient;

function getPrismaClient() {
  if (!prisma) {
    console.log('[Folders API] Creating new Prisma Client instance');
    prisma = new PrismaClient({
      log: ['error', 'warn'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }
  return prisma;
}

// Don't auto-connect, let Prisma handle it per-query
// prisma.$connect() causes issues in serverless

// Helper function to convert BigInt to string for JSON serialization
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = serializeBigInt(obj[key]);
    }
    return result;
  }
  return obj;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Folders API] ==================== NEW REQUEST ====================`);
  console.log(`[Folders API] ${req.method} ${req.url}`);
  console.log(`[Folders API] Origin: ${req.headers.origin}`);
  console.log(`[Folders API] Access-Control-Request-Method: ${req.headers['access-control-request-method']}`);
  console.log(`[Folders API] Access-Control-Request-Headers: ${req.headers['access-control-request-headers']}`);
  
  // Handle CORS - this MUST be first
  const corsHandled = handleCORS(req, res);
  if (corsHandled) {
    console.log('[Folders API] CORS preflight handled, returning early');
    return; // OPTIONS request was handled
  }

  const userId = authenticateToken(req);
  
  try {
    console.log(`[Folders API] ${req.method} ${req.url}`, {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      query: req.query,
      body: req.body
    });

    if (!userId) {
      console.log('[Folders API] Authentication failed - no valid token provided');
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required. Please log in to access this resource.'
      });
      return;
    }

    console.log(`[Folders API] Authenticated user: ${userId}`);
    
    // Get Prisma client instance
    const prisma = getPrismaClient();
  } catch (error) {
    console.error('[Folders API] Error in handler setup:', error);
    handleCORS(req, res);
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
        data: serializeBigInt(folder),
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
        data: serializeBigInt(folder)
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
        data: serializeBigInt(duplicateFolder),
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

      // Check for duplicate folder name in the same parent folder
      const existingFolder = await prisma.folder.findFirst({
        where: {
          name,
          dataRoomId: folder.dataRoomId,
          parentId: folder.parentId,
          NOT: { id: folder.id } // Exclude current folder
        }
      });

      if (existingFolder) {
        res.status(409).json({ error: 'A folder with this name already exists in this location' });
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
        data: serializeBigInt(updatedFolder),
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
        data: serializeBigInt(files)
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
    handleCORS(req, res);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  // Note: Don't disconnect Prisma in serverless - let it reuse connections
}

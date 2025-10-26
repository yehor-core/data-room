import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { handleCORS } from './_cors';

// Inline authentication middleware
const authenticateToken = (req: VercelRequest): string | null => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔍 Auth header:', authHeader);
  console.log('🔍 Token:', token ? token.substring(0, 20) + '...' : 'null');
  console.log('🔍 JWT_SECRET exists:', !!process.env.JWT_SECRET);

  if (!token) {
    console.log('❌ No token found');
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    console.log('✅ Token valid, userId:', decoded.userId);
    return decoded.userId;
  } catch (error) {
    console.log('❌ Token validation failed:', error);
    return null;
  }
};

// Use a singleton pattern for Prisma Client in serverless
let prisma: PrismaClient;

function getPrismaClient() {
  if (!prisma) {
    console.log('[Data Rooms API] Creating new Prisma Client instance');
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

// Helper function to convert BigInt to string for JSON serialization
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log(`[Data Rooms API] ==================== NEW REQUEST ====================`);
  console.log(`[Data Rooms API] ${req.method} ${req.url}`);
  console.log(`[Data Rooms API] Origin: ${req.headers.origin}`);
  
  // Handle CORS - this MUST be first
  const corsHandled = handleCORS(req, res);
  if (corsHandled) {
    console.log('[Data Rooms API] CORS preflight handled, returning early');
    return; // OPTIONS request was handled
  }

  const userId = authenticateToken(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get Prisma client instance
  const prisma = getPrismaClient();

  const { id, action } = req.query;

  try {

    if (req.method === 'GET' && !id) {
      // Get all data rooms for the user
      const dataRooms = await prisma.dataRoom.findMany({
        where: { ownerId: userId },
        include: {
          _count: {
            select: { folders: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json({
        success: true,
        data: dataRooms,
        pagination: {
          page: 1,
          limit: 10,
          total: dataRooms.length,
          totalPages: 1
        }
      });

    } else if (req.method === 'POST' && !id) {
      // Create a new data room
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      // Check for duplicate data room name for this user
      const existingDataRoom = await prisma.dataRoom.findFirst({
        where: {
          name,
          ownerId: userId,
        }
      });

      if (existingDataRoom) {
        res.status(409).json({ error: 'A data room with this name already exists' });
        return;
      }

      const dataRoom = await prisma.dataRoom.create({
        data: {
          name,
          ownerId: userId,
        },
        include: {
          _count: {
            select: { folders: true }
          }
        }
      });

      return res.status(201).json({
        success: true,
        data: dataRoom,
        message: 'Data room created successfully'
      });

    } else if (action === 'folders' && id && typeof id === 'string') {
      // Get folders for a data room
      const folders = await prisma.folder.findMany({
        where: { 
          dataRoomId: id,
          dataRoom: {
            ownerId: userId
          }
        },
        include: {
          _count: {
            select: { 
              files: true,
              children: true 
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json({
        success: true,
        data: folders
      });

    } else if (action === 'files' && id && typeof id === 'string') {
      // Get files for a data room (root level files)
      const files = await prisma.file.findMany({
        where: { 
          folder: {
            dataRoomId: id,
            dataRoom: {
              ownerId: userId
            },
            parentId: null // Only root level files
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json({
        success: true,
        data: serializeBigInt(files)
      });

    } else if (req.method === 'GET' && id && typeof id === 'string') {
      // Get specific data room (must come AFTER action routes)
      const dataRoom = await prisma.dataRoom.findFirst({
        where: { 
          id,
          ownerId: userId 
        },
        include: {
          _count: {
            select: { 
              folders: {
                where: { parentId: null } // Only count root folders
              }
            }
          },
          folders: {
            where: { parentId: null }, // Only root folders
            include: {
              _count: {
                select: { 
                  files: true,
                  children: true 
                }
              }
            }
          }
        }
      });

      if (!dataRoom) {
        res.status(404).json({ error: 'Data room not found' });
        return;
      }

      return res.status(200).json({
        success: true,
        data: dataRoom
      });

    } else if (req.method === 'DELETE' && id && typeof id === 'string') {
      // Delete data room
      const dataRoom = await prisma.dataRoom.findFirst({
        where: { 
          id,
          ownerId: userId 
        }
      });

      if (!dataRoom) {
        res.status(404).json({ error: 'Data room not found' });
        return;
      }

      await prisma.dataRoom.delete({
        where: { id }
      });

      return res.status(200).json({
        success: true,
        message: 'Data room deleted successfully'
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ Data rooms API error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
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

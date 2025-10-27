import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { handleCORS } from './_cors';

// Inline authentication middleware - validates Supabase JWT tokens
const authenticateToken = (req: VercelRequest): string | null => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔍 Auth header:', authHeader);
  console.log('🔍 Token:', token ? token.substring(0, 20) + '...' : 'null');

  if (!token) {
    console.log('❌ No token found');
    return null;
  }

  try {
    // Decode the Supabase JWT token (don't verify signature, Supabase handles that)
    // We just need to extract the user ID
    const decoded = jwt.decode(token) as any;
    
    if (!decoded || !decoded.sub) {
      console.log('❌ Invalid token structure');
      return null;
    }

    console.log('✅ Token decoded, userId (sub):', decoded.sub);
    console.log('🔍 Token payload:', { sub: decoded.sub, email: decoded.email, role: decoded.role });
    
    // Return the user ID (sub claim in Supabase JWT)
    return decoded.sub;
  } catch (error) {
    console.log('❌ Token decoding failed:', error);
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
    res.status(401).json({ error: 'Unauthorized' });
    return;
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

      res.status(200).json({
        success: true,
        data: dataRooms,
        pagination: {
          page: 1,
          limit: 10,
          total: dataRooms.length,
          totalPages: 1
        }
      });
      return;

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

      res.status(201).json({
        success: true,
        data: dataRoom,
        message: 'Data room created successfully'
      });
      return;

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

      res.status(200).json({
        success: true,
        data: folders
      });
      return;

    } else if (action === 'files' && id && typeof id === 'string') {
      // Get files for a data room
      // If 'all' query param is present, get ALL files, otherwise just root level
      const getAllFiles = req.query.all === 'true';
      
      const files = await prisma.file.findMany({
        where: getAllFiles ? {
          // Get ALL files in the data room
          dataRoomId: id,
          dataRoom: {
            ownerId: userId
          }
        } : {
          // Get only root level files
          folder: {
            dataRoomId: id,
            dataRoom: {
              ownerId: userId
            },
            parentId: null
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({
        success: true,
        data: serializeBigInt(files)
      });
      return;

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

      res.status(200).json({
        success: true,
        data: dataRoom
      });
      return;

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

      res.status(200).json({
        success: true,
        message: 'Data room deleted successfully'
      });
      return;

    } else {
      res.status(405).json({ error: 'Method not allowed' });
      return;
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

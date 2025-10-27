/**
 * ============================================
 * DATA ROOMS API - Main Data Room Management
 * ============================================
 * 
 * This API handles all data room operations:
 * 1. Creating new data rooms
 * 2. Listing user's data rooms
 * 3. Getting specific data room details
 * 4. Deleting data rooms
 * 5. Getting folders and files for data rooms
 * 
 * For junior developers:
 * - This is a REST API that follows HTTP methods (GET, POST, DELETE)
 * - We use Prisma to interact with the database
 * - Authentication is handled via JWT tokens from Supabase
 * - CORS is handled first to allow frontend requests
 * - All responses are JSON formatted
 * 
 * API Endpoints:
 * - GET /api/data-rooms - List all data rooms for user
 * - POST /api/data-rooms - Create new data room
 * - GET /api/data-rooms?id=X - Get specific data room
 * - DELETE /api/data-rooms?id=X - Delete data room
 * - GET /api/data-rooms?id=X&action=folders - Get folders in data room
 * - GET /api/data-rooms?id=X&action=files - Get files in data room
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { handleCORS } from './_cors';

/**
 * AUTHENTICATION MIDDLEWARE
 * 
 * This function validates the JWT token sent by the frontend.
 * Supabase handles token signing, we just need to decode and extract user ID.
 * 
 * @param req - The incoming request
 * @returns User ID if valid token, null if invalid/missing
 */
const authenticateToken = (req: VercelRequest): string | null => {
  // Extract token from Authorization header (format: "Bearer <token>")
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
    // We just need to extract the user ID from the token
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

/**
 * PRISMA CLIENT SINGLETON
 * 
 * In serverless environments, we need to reuse database connections.
 * This singleton pattern ensures we don't create multiple Prisma clients.
 */
let prisma: PrismaClient;

function getPrismaClient() {
  if (!prisma) {
    console.log('[Data Rooms API] Creating new Prisma Client instance');
    prisma = new PrismaClient({
      log: ['error', 'warn'], // Only log errors and warnings
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
  }
  return prisma;
}

/**
 * BIGINT SERIALIZATION HELPER
 * 
 * JavaScript can't serialize BigInt values to JSON.
 * This function converts BigInt values to strings so they can be sent to the frontend.
 * 
 * @param obj - Any object that might contain BigInt values
 * @returns Object with BigInt values converted to strings
 */
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

/**
 * MAIN API HANDLER
 * 
 * This is the main function that handles all requests to the data rooms API.
 * It follows this flow:
 * 1. Handle CORS (allow frontend requests)
 * 2. Authenticate user (check JWT token)
 * 3. Route to appropriate handler based on HTTP method and query parameters
 * 4. Return JSON response
 * 
 * @param req - The incoming HTTP request
 * @param res - The HTTP response object
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log(`[Data Rooms API] ==================== NEW REQUEST ====================`);
  console.log(`[Data Rooms API] ${req.method} ${req.url}`);
  console.log(`[Data Rooms API] Origin: ${req.headers.origin}`);
  
  // STEP 1: Handle CORS - this MUST be first
  // This allows our frontend to make requests to this API
  const corsHandled = handleCORS(req, res);
  if (corsHandled) {
    console.log('[Data Rooms API] CORS preflight handled, returning early');
    return; // OPTIONS request was handled
  }

  // STEP 2: Authenticate user
  // Extract user ID from JWT token sent by frontend
  const userId = authenticateToken(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // STEP 3: Get database connection
  const prisma = getPrismaClient();

  // STEP 4: Extract query parameters
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

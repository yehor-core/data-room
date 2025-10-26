import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { setCorsHeaders, handlePreflight } from '../src/config/cors';
import formidable from 'formidable';
import { uploadFile } from '../src/utils/supabase';
import { promises as fs } from 'fs';

// Inline authentication middleware
const authenticateToken = (req: VercelRequest): string | null => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  console.log('[Files API] Auth header:', authHeader ? 'Present' : 'Missing');
  console.log('[Files API] JWT Secret available:', !!process.env.JWT_SECRET);

  if (!token) {
    console.log('[Files API] No token found in authorization header');
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    console.log('[Files API] Token decoded successfully for user:', decoded.userId);
    return decoded.userId;
  } catch (error) {
    console.error('[Files API] Token verification failed:', error);
    return null;
  }
};

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Test database connection
prisma.$connect().catch((error) => {
  console.error('[Files API] Database connection failed:', error);
});

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

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ALWAYS set CORS headers first, no matter what
  try {
    setCorsHeaders(res, req.headers.origin);
  } catch (e) {
    console.error('Failed to set CORS headers:', e);
  }

  // Handle OPTIONS preflight requests FIRST
  if (req.method === 'OPTIONS') {
    console.log('[Files API] Handling OPTIONS preflight request');
    try {
      handlePreflight(req, res);
      console.log('[Files API] OPTIONS preflight handled successfully');
      return;
    } catch (error) {
      console.error('[Files API] Error handling OPTIONS preflight:', error);
      // Fallback CORS headers
      res.setHeader('Access-Control-Allow-Origin', 'https://data-room-196e.vercel.app');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(200).end();
      return;
    }
  }

  const { id, action } = req.query;
  const userId = authenticateToken(req);
  
  try {
    console.log(`[Files API] ${req.method} ${req.url}`, {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      query: req.query,
      contentType: req.headers['content-type']
    });

    console.log('🔐 Auth check:', { 
      userId, 
      hasAuthHeader: !!req.headers.authorization,
      action,
      method: req.method 
    });
    
    if (!userId) {
      console.error('❌ Unauthorized - no valid token');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('[Files API] Database connection successful');
    } catch (dbError) {
      console.error('[Files API] Database connection failed:', dbError);
      setCorsHeaders(res, req.headers.origin);
      res.status(500).json({ 
        error: 'Database connection failed',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error'
      });
      return;
    }
  } catch (error) {
    console.error('[Files API] Error in handler setup:', error);
    setCorsHeaders(res, req.headers.origin);
    res.status(500).json({ error: 'Internal server error during setup' });
    return;
  }

  try {
    if (req.method === 'POST' && action === 'upload') {
      console.log('[Files API] Starting file upload process');
      
      // Handle file upload with formidable
      const form = formidable({
        maxFileSize: 100 * 1024 * 1024, // 100MB for Vercel Pro
      });

      console.log('[Files API] Parsing form data...');
      const [fields, files] = await form.parse(req as any);
      
      const name = fields.name?.[0];
      const folderId = fields.folderId?.[0];
      const uploadedFile = files.file?.[0];

      console.log('[Files API] Form data parsed:', {
        name,
        folderId,
        hasFile: !!uploadedFile,
        fileName: uploadedFile?.originalFilename,
        fileSize: uploadedFile?.size
      });

      if (!name || !folderId || !uploadedFile) {
        console.log('[Files API] Missing required fields:', { name: !!name, folderId: !!folderId, file: !!uploadedFile });
        res.status(400).json({ error: 'Name, folderId, and file are required' });
        return;
      }

      // Verify the user has access to the folder
      console.log('[Files API] Verifying folder access...');
      const folder = await prisma.folder.findFirst({
        where: { 
          id: folderId,
          dataRoom: {
            ownerId: userId
          }
        }
      });

      if (!folder) {
        console.log('[Files API] Folder not found or no access:', folderId);
        res.status(404).json({ error: 'Folder not found' });
        return;
      }

      console.log('[Files API] Folder verified:', folder.name);

      // Check for duplicate file name in same folder and generate unique name
      console.log('[Files API] Checking for duplicate file name...');
      let finalFileName = name;
      let counter = 1;
      
      while (true) {
        const existingFile = await prisma.file.findFirst({
          where: {
            name: finalFileName,
            folderId,
          }
        });

        if (!existingFile) {
          break; // No duplicate found, use this name
        }

        // Generate a new name with a counter
        const nameParts = name.split('.');
        if (nameParts.length > 1) {
          const extension = nameParts.pop();
          const baseName = nameParts.join('.');
          finalFileName = `${baseName} (${counter}).${extension}`;
        } else {
          finalFileName = `${name} (${counter})`;
        }
        counter++;
        
        // Prevent infinite loop
        if (counter > 100) {
          console.log('[Files API] Too many duplicates, using timestamp');
          const timestamp = Date.now();
          const nameParts = name.split('.');
          if (nameParts.length > 1) {
            const extension = nameParts.pop();
            const baseName = nameParts.join('.');
            finalFileName = `${baseName}_${timestamp}.${extension}`;
          } else {
            finalFileName = `${name}_${timestamp}`;
          }
          break;
        }
      }

      if (finalFileName !== name) {
        console.log('[Files API] Generated unique filename:', finalFileName);
      }

      console.log('[Files API] No duplicate found, proceeding with upload...');

      // Read the file buffer
      console.log('[Files API] Reading file buffer...');
      const fileBuffer = await fs.readFile(uploadedFile.filepath);
      
      // Upload to Supabase Storage
      console.log('[Files API] Uploading to Supabase Storage...');
      const blobUrl = await uploadFile(fileBuffer, uploadedFile.originalFilename || name);

      console.log('[Files API] File uploaded to storage, creating database record...');

      // Create file record in database
      const file = await prisma.file.create({
        data: {
          name: finalFileName, // Use the unique filename
          mimeType: uploadedFile.mimetype || 'application/octet-stream',
          fileSize: BigInt(uploadedFile.size),
          filePath: blobUrl, // Store the public URL as filePath for now
          folderId,
          dataRoomId: folder.dataRoomId,
          userId: userId,
        }
      });

      console.log('[Files API] File upload completed successfully:', file.id);

      res.status(201).json({
        success: true,
        data: serializeBigInt(file),
        message: finalFileName !== name 
          ? `File uploaded successfully as "${finalFileName}" (original name was already in use)`
          : 'File uploaded successfully'
      });

    } else if (req.method === 'POST' && id && typeof id === 'string' && action === 'duplicate') {
      // Duplicate file
      const file = await prisma.file.findFirst({
        where: { 
          id,
          folder: {
            dataRoom: {
              ownerId: userId
            }
          }
        }
      });

      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Create duplicate file record
      const duplicateFile = await prisma.file.create({
        data: {
          name: `${file.name} (Copy)`,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          filePath: file.filePath, // Same file in storage
          folderId: file.folderId,
          dataRoomId: file.dataRoomId,
          userId: userId,
        }
      });

      res.status(201).json({
        success: true,
        data: serializeBigInt(duplicateFile),
        message: 'File duplicated successfully'
      });

    } else if (req.method === 'PATCH' && id && typeof id === 'string') {
      // Update file
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const file = await prisma.file.findFirst({
        where: { 
          id,
          folder: {
            dataRoom: {
              ownerId: userId
            }
          }
        }
      });

      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const updatedFile = await prisma.file.update({
        where: { id },
        data: { name }
      });

      res.status(200).json({
        success: true,
        data: serializeBigInt(updatedFile),
        message: 'File updated successfully'
      });

    } else if (req.method === 'DELETE' && id && typeof id === 'string') {
      // Delete file
      const file = await prisma.file.findFirst({
        where: { 
          id,
          folder: {
            dataRoom: {
              ownerId: userId
            }
          }
        }
      });

      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      await prisma.file.delete({
        where: { id }
      });

      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[Files API] Error in main handler:', error);
    console.error('[Files API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      method: req.method,
      url: req.url,
      query: req.query,
      action: req.query.action
    });
    
    // Ensure CORS headers are set even on error
    setCorsHeaders(res, req.headers.origin);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
}

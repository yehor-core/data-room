/**
 * Comprehensive Data Rooms API Tests
 * Tests all endpoints with various scenarios including edge cases
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import dataRoomsHandler from '../../../api/data-rooms';
import { generateToken } from '../../middleware/auth';

const prisma = new PrismaClient();
let testUserId: string;
let testToken: string;
let testDataRoomId: string;

describe('Data Rooms API - Comprehensive Tests', () => {
  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.upsert({
      where: { email: 'dataroom-enhanced-test@example.com' },
      update: {},
      create: {
        email: 'dataroom-enhanced-test@example.com',
        name: 'Enhanced Test User',
      },
    });
    testUserId = user.id;
    testToken = generateToken(user.id);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.dataRoom.deleteMany({ where: { ownerId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up data rooms created in tests
    await prisma.dataRoom.deleteMany({
      where: {
        ownerId: testUserId,
        name: { startsWith: 'Test-' }
      }
    });
  });

  describe('POST /api/data-rooms - Create Data Room', () => {
    it('should create a data room with valid data', async () => {
      const mockReq = {
        method: 'POST',
        headers: { authorization: `Bearer ${testToken}` },
        body: { name: 'Test-Valid Data Room' },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: 'Test-Valid Data Room',
          }),
        })
      );
    });

    it('should reject duplicate data room names', async () => {
      // Create first data room
      await prisma.dataRoom.create({
        data: {
          name: 'Test-Duplicate',
          ownerId: testUserId,
        },
      });

      const mockReq = {
        method: 'POST',
        headers: { authorization: `Bearer ${testToken}` },
        body: { name: 'Test-Duplicate' },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'A data room with this name already exists',
        })
      );
    });

    it('should reject empty name', async () => {
      const mockReq = {
        method: 'POST',
        headers: { authorization: `Bearer ${testToken}` },
        body: { name: '' },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should reject missing name field', async () => {
      const mockReq = {
        method: 'POST',
        headers: { authorization: `Bearer ${testToken}` },
        body: {},
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should reject unauthorized requests', async () => {
      const mockReq = {
        method: 'POST',
        headers: {},
        body: { name: 'Test-Unauthorized' },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should handle very long names gracefully', async () => {
      const longName = 'A'.repeat(500);
      const mockReq = {
        method: 'POST',
        headers: { authorization: `Bearer ${testToken}` },
        body: { name: longName },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      // Should either accept or reject gracefully, not crash
      expect(mockRes.status).toHaveBeenCalled();
    });

    it('should handle special characters in name', async () => {
      const specialName = 'Test-Special!@#$%^&*()';
      const mockReq = {
        method: 'POST',
        headers: { authorization: `Bearer ${testToken}` },
        body: { name: specialName },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('GET /api/data-rooms - List Data Rooms', () => {
    beforeEach(async () => {
      // Create test data rooms
      await prisma.dataRoom.createMany({
        data: [
          { name: 'Test-Room1', ownerId: testUserId },
          { name: 'Test-Room2', ownerId: testUserId },
          { name: 'Test-Room3', ownerId: testUserId },
        ],
      });
    });

    it('should list all data rooms for authenticated user', async () => {
      const mockReq = {
        method: 'GET',
        headers: { authorization: `Bearer ${testToken}` },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'Test-Room1' }),
          ]),
        })
      );
    });

    it('should return empty array for user with no data rooms', async () => {
      // Create new user with no data rooms
      const newUser = await prisma.user.create({
        data: {
          email: 'empty-user@example.com',
          name: 'Empty User',
        },
      });
      const emptyToken = generateToken(newUser.id);

      const mockReq = {
        method: 'GET',
        headers: { authorization: `Bearer ${emptyToken}` },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [],
        })
      );

      // Cleanup
      await prisma.user.delete({ where: { id: newUser.id } });
    });

    it('should include folder count in response', async () => {
      const dataRoom = await prisma.dataRoom.findFirst({
        where: { ownerId: testUserId, name: 'Test-Room1' },
      });

      if (dataRoom) {
        // Add a folder to test _count
        await prisma.folder.create({
          data: {
            name: 'Test-Folder',
            dataRoomId: dataRoom.id,
            userId: testUserId,
          },
        });
      }

      const mockReq = {
        method: 'GET',
        headers: { authorization: `Bearer ${testToken}` },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              _count: expect.objectContaining({ folders: expect.any(Number) }),
            }),
          ]),
        })
      );
    });
  });

  describe('GET /api/data-rooms?id={id} - Get Single Data Room', () => {
    beforeEach(async () => {
      const dataRoom = await prisma.dataRoom.create({
        data: {
          name: 'Test-SingleRoom',
          ownerId: testUserId,
        },
      });
      testDataRoomId = dataRoom.id;
    });

    it('should get data room by ID', async () => {
      const mockReq = {
        method: 'GET',
        headers: { authorization: `Bearer ${testToken}` },
        query: { id: testDataRoomId },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: testDataRoomId,
            name: 'Test-SingleRoom',
          }),
        })
      );
    });

    it('should return 404 for non-existent data room', async () => {
      const mockReq = {
        method: 'GET',
        headers: { authorization: `Bearer ${testToken}` },
        query: { id: '00000000-0000-0000-0000-000000000000' },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should reject access to other users data rooms', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-user@example.com',
          name: 'Other User',
        },
      });
      const otherToken = generateToken(otherUser.id);

      const mockReq = {
        method: 'GET',
        headers: { authorization: `Bearer ${otherToken}` },
        query: { id: testDataRoomId },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(404);

      // Cleanup
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('DELETE /api/data-rooms?id={id} - Delete Data Room', () => {
    it('should delete data room and cascade to folders/files', async () => {
      // Create data room with folder and file
      const dataRoom = await prisma.dataRoom.create({
        data: {
          name: 'Test-ToDelete',
          ownerId: testUserId,
        },
      });

      const folder = await prisma.folder.create({
        data: {
          name: 'Test-Folder',
          dataRoomId: dataRoom.id,
          userId: testUserId,
        },
      });

      await prisma.file.create({
        data: {
          name: 'Test-File.pdf',
          dataRoomId: dataRoom.id,
          folderId: folder.id,
          userId: testUserId,
          mimeType: 'application/pdf',
        },
      });

      const mockReq = {
        method: 'DELETE',
        headers: { authorization: `Bearer ${testToken}` },
        query: { id: dataRoom.id },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);

      // Verify cascading delete
      const deletedFolder = await prisma.folder.findUnique({
        where: { id: folder.id },
      });
      expect(deletedFolder).toBeNull();
    });

    it('should return 404 for non-existent data room', async () => {
      const mockReq = {
        method: 'DELETE',
        headers: { authorization: `Bearer ${testToken}` },
        query: { id: '00000000-0000-0000-0000-000000000000' },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Disconnect prisma to simulate error
      await prisma.$disconnect();

      const mockReq = {
        method: 'GET',
        headers: { authorization: `Bearer ${testToken}` },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error',
        })
      );

      // Reconnect
      await prisma.$connect();
    });

    it('should handle invalid JWT tokens', async () => {
      const mockReq = {
        method: 'GET',
        headers: { authorization: 'Bearer invalid-token' },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const mockReq = {
        method: 'OPTIONS',
        headers: { origin: 'https://data-room-196e.vercel.app' },
        query: {},
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };

      await dataRoomsHandler(mockReq as any, mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        expect.any(String)
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});


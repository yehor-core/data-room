import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../types';
import { createError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

// Get current user
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json(req.user);
});


// Note: The Google OAuth route is commented out as it's incomplete and relies on a removed dependency.
/*
router.post('/google', async (req, res, next) => {
  const { token } = req.body;
  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { name, email, picture } = ticket.getPayload();
    
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { name, email, image: picture },
      });
    }

    // Create a session or JWT for the user
    // ... implementation needed ...

    res.status(200).json({ user });
  } catch (error) {
    next(createError('Google authentication failed', 401));
  }
});
*/

export { router as authRoutes };

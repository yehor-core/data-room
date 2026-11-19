import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../types';
import { createError } from './errorHandler';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw createError('Access token required', 401);
    }

    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      throw createError('Invalid or expired token', 401);
    }

    let user = await prisma.user.findUnique({
      where: { email: supabaseUser.email! },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: supabaseUser.email!,
          name: supabaseUser.user_metadata?.full_name || supabaseUser.email!.split('@')[0],
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    req.user = user;
    next();
  } catch (error: any) {
    next(createError(error.message || 'Authentication failed', 401));
  }
};

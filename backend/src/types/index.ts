import { Request } from 'express';
import { Prisma } from '@prisma/client';

export const userSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type User = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export interface AuthenticatedRequest extends Request {
  user: User;
}

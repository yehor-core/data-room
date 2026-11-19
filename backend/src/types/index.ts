import { Request } from 'express';

interface UserWithoutPassword {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: UserWithoutPassword;
}

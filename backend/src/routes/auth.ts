import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

export { router as authRoutes };

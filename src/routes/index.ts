import { Router } from 'express';
import { sendSuccess } from '../utils/response';
import authRoutes from './auth.routes';

const router = Router();

router.get('/health', (_req, res) => {
  return sendSuccess(res, {
    message: 'Server is running',
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);

export default router;

import { Router } from 'express';
import { sendSuccess } from '../utils/response';

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

export default router;

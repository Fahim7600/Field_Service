import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { sendSuccess } from '../utils/response';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import catalogRoutes from './catalog.routes';
import technicianRoutes from './technician.routes';
import technicianApplicationRoutes from './technician-application.routes';
import userRoutes from './user.routes';

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
router.use('/users', userRoutes);
router.use('/technicians', technicianRoutes);
router.use('/technician-applications', technicianApplicationRoutes);
router.use('/', catalogRoutes);
router.use('/admin', authenticate, authorize('ADMIN'), adminRoutes);

export default router;

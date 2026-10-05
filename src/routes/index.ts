import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { sendSuccess } from '../utils/response';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import catalogRoutes from './catalog.routes';
import customerRoutes from './customer.routes';
import feedbackRoutes from './feedback.routes';
import invoiceRoutes from './invoice.routes';
import notificationRoutes from './notification.routes';
import paymentRoutes from './payment.routes';
import serviceRequestRoutes from './service-request.routes';
import subscriptionRoutes from './subscription.routes';
import subscriptionPlanRoutes from './subscription-plan.routes';
import technicianRoutes from './technician.routes';
import technicianApplicationRoutes from './technician-application.routes';
import userRoutes from './user.routes';
import workOrderRoutes from './work-order.routes';

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
router.use('/customers', customerRoutes);
router.use('/technicians', technicianRoutes);
router.use('/technician-applications', technicianApplicationRoutes);
router.use('/service-requests', serviceRequestRoutes);
router.use('/work-orders', workOrderRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/notifications', notificationRoutes);
router.use('/subscription-plans', subscriptionPlanRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/', catalogRoutes);
router.use('/admin', authenticate, authorize('ADMIN'), adminRoutes);

export default router;

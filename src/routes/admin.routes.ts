import { Router } from 'express';
import adminAuditRoutes from './admin-audit.routes';
import adminCatalogRoutes from './admin-catalog.routes';
import adminCustomerRoutes from './admin-customer.routes';
import adminDispatchRoutes from './admin-dispatch.routes';
import adminInvoiceRoutes from './admin-invoice.routes';
import adminPaymentRoutes from './admin-payment.routes';
import adminStatsRoutes from './admin-stats.routes';
import adminSubscriptionRoutes from './admin-subscription.routes';
import adminTechnicianApplicationRoutes from './admin-technician-application.routes';
import adminUserRoutes from './admin-user.routes';

const router = Router();

router.use('/', adminCatalogRoutes);
router.use('/', adminDispatchRoutes);
router.use('/', adminStatsRoutes);
router.use('/audit-logs', adminAuditRoutes);
router.use('/customers', adminCustomerRoutes);
router.use('/invoices', adminInvoiceRoutes);
router.use('/payments', adminPaymentRoutes);
router.use('/subscriptions', adminSubscriptionRoutes);
router.use('/technician-applications', adminTechnicianApplicationRoutes);
router.use('/users', adminUserRoutes);

export default router;

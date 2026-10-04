import { Router } from 'express';
import adminCatalogRoutes from './admin-catalog.routes';
import adminCustomerRoutes from './admin-customer.routes';
import adminDispatchRoutes from './admin-dispatch.routes';
import adminInvoiceRoutes from './admin-invoice.routes';
import adminPaymentRoutes from './admin-payment.routes';
import adminSubscriptionRoutes from './admin-subscription.routes';
import adminTechnicianApplicationRoutes from './admin-technician-application.routes';

const router = Router();

router.use('/', adminCatalogRoutes);
router.use('/', adminDispatchRoutes);
router.use('/customers', adminCustomerRoutes);
router.use('/invoices', adminInvoiceRoutes);
router.use('/payments', adminPaymentRoutes);
router.use('/subscriptions', adminSubscriptionRoutes);
router.use('/technician-applications', adminTechnicianApplicationRoutes);

export default router;

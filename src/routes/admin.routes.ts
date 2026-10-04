import { Router } from 'express';
import adminCatalogRoutes from './admin-catalog.routes';
import adminDispatchRoutes from './admin-dispatch.routes';
import adminTechnicianApplicationRoutes from './admin-technician-application.routes';

const router = Router();

router.use('/', adminCatalogRoutes);
router.use('/', adminDispatchRoutes);
router.use('/technician-applications', adminTechnicianApplicationRoutes);

export default router;

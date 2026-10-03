import { Router } from 'express';
import adminCatalogRoutes from './admin-catalog.routes';

const router = Router();

router.use('/', adminCatalogRoutes);

export default router;

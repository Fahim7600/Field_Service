import { Router } from 'express';
import * as adminStatsController from '../controllers/admin-stats.controller';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';

const router = Router();

router.get('/dashboard-stats', adminStatsController.getDashboardStats);

router.get(
  '/technicians/:id/analytics',
  validate({ params: idParamSchema }),
  adminStatsController.getTechnicianAnalytics,
);

export default router;

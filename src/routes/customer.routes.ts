import { Router } from 'express';
import * as workOrderController from '../controllers/work-order.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { listServiceHistoryQuery } from '../validators/work-order.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/me/service-history',
  authorize('CUSTOMER'),
  validate({ query: listServiceHistoryQuery }),
  workOrderController.getCustomerServiceHistory,
);

export default router;

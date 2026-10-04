import { Router } from 'express';
import * as workOrderController from '../controllers/work-order.controller';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import { listServiceHistoryQuery } from '../validators/work-order.validator';

const router = Router();

router.get(
  '/:id/service-history',
  validate({ params: idParamSchema, query: listServiceHistoryQuery }),
  workOrderController.getAdminCustomerServiceHistory,
);

export default router;

import { Router } from 'express';
import * as workOrderController from '../controllers/work-order.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema, paginationQuery } from '../validators/common.validator';
import {
  assignTechnicianSchema,
  listWorkOrdersQuery,
  rejectWorkOrderSchema,
  scheduleWorkOrderSchema,
} from '../validators/work-order.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('CUSTOMER', 'TECHNICIAN', 'ADMIN'),
  validate({ query: listWorkOrdersQuery }),
  workOrderController.listWorkOrders,
);

router.get(
  '/my-assigned',
  authorize('TECHNICIAN'),
  validate({ query: paginationQuery(10, 100) }),
  workOrderController.getMyAssigned,
);

router.get(
  '/:id',
  authorize('CUSTOMER', 'TECHNICIAN', 'ADMIN'),
  validate({ params: idParamSchema }),
  workOrderController.getWorkOrderById,
);

router.get(
  '/:id/history',
  authorize('CUSTOMER', 'TECHNICIAN', 'ADMIN'),
  validate({ params: idParamSchema, query: paginationQuery(50, 100) }),
  workOrderController.getWorkOrderHistory,
);

router.post(
  '/:id/assign',
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: assignTechnicianSchema }),
  workOrderController.assignTechnician,
);

router.post(
  '/:id/accept',
  authorize('TECHNICIAN'),
  validate({ params: idParamSchema }),
  workOrderController.acceptWorkOrder,
);

router.post(
  '/:id/reject',
  authorize('TECHNICIAN'),
  validate({ params: idParamSchema, body: rejectWorkOrderSchema }),
  workOrderController.rejectWorkOrder,
);

router.post(
  '/:id/schedule',
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: scheduleWorkOrderSchema }),
  workOrderController.scheduleWorkOrder,
);

export default router;

import { Router } from 'express';
import * as serviceRequestController from '../controllers/service-request.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import {
  createServiceRequestSchema,
  listServiceRequestsQuery,
  searchServiceRequestsQuery,
  updateServiceRequestSchema,
} from '../validators/service-request.validator';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('CUSTOMER'),
  validate({ body: createServiceRequestSchema }),
  serviceRequestController.createServiceRequest,
);

router.get(
  '/',
  authorize('CUSTOMER', 'ADMIN'),
  validate({ query: listServiceRequestsQuery }),
  serviceRequestController.listServiceRequests,
);

router.get(
  '/search',
  authorize('CUSTOMER', 'ADMIN'),
  validate({ query: searchServiceRequestsQuery }),
  serviceRequestController.searchServiceRequests,
);

router.get(
  '/:id',
  authorize('CUSTOMER', 'TECHNICIAN', 'ADMIN'),
  validate({ params: idParamSchema }),
  serviceRequestController.getServiceRequestById,
);

router.patch(
  '/:id',
  authorize('CUSTOMER'),
  validate({ params: idParamSchema, body: updateServiceRequestSchema }),
  serviceRequestController.updateServiceRequest,
);

router.delete(
  '/:id',
  authorize('CUSTOMER'),
  validate({ params: idParamSchema }),
  serviceRequestController.deleteServiceRequest,
);

export default router;

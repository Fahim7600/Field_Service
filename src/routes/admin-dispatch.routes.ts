import { Router } from 'express';
import * as dispatchController from '../controllers/dispatch.controller';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import {
  availableTechniciansQuery,
  dispatchQueueQuery,
  reviewServiceRequestSchema,
} from '../validators/dispatch.validator';

const router = Router();

router.get(
  '/dispatch-queue',
  validate({ query: dispatchQueueQuery }),
  dispatchController.getDispatchQueue,
);

router.patch(
  '/service-requests/:id/review',
  validate({ params: idParamSchema, body: reviewServiceRequestSchema }),
  dispatchController.reviewServiceRequest,
);

router.get(
  '/technicians/available',
  validate({ query: availableTechniciansQuery }),
  dispatchController.getAvailableTechnicians,
);

export default router;

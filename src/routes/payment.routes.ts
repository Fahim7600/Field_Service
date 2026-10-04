import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import {
  initiatePaymentSchema,
  listPaymentsQuery,
  sessionIdQuerySchema,
} from '../validators/payment.validator';

const router = Router();

// Public routes (must be declared BEFORE /:id)
router.post('/webhook', paymentController.handleWebhook);

router.get(
  '/success',
  validate({ query: sessionIdQuerySchema }),
  paymentController.getSuccessStatus,
);

router.get('/cancel', validate({ query: sessionIdQuerySchema }), paymentController.getCancelStatus);

// Authenticated routes
router.post(
  '/initiate',
  authenticate,
  authorize('CUSTOMER'),
  validate({ body: initiatePaymentSchema }),
  paymentController.initiatePayment,
);

router.get(
  '/',
  authenticate,
  authorize('CUSTOMER', 'ADMIN'),
  validate({ query: listPaymentsQuery }),
  paymentController.listPayments,
);

router.get(
  '/:id',
  authenticate,
  authorize('CUSTOMER', 'ADMIN'),
  validate({ params: idParamSchema }),
  paymentController.getPaymentById,
);

export default router;

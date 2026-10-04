import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import { refundPaymentSchema } from '../validators/payment.validator';

const router = Router();

router.post(
  '/:id/refund',
  validate({ params: idParamSchema, body: refundPaymentSchema }),
  paymentController.refundPayment,
);

export default router;

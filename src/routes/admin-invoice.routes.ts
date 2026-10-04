import { Router } from 'express';
import * as invoiceController from '../controllers/invoice.controller';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
} from '../validators/invoice.validator';

const router = Router();

router.post('/', validate({ body: createInvoiceSchema }), invoiceController.createInvoice);

router.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateInvoiceSchema }),
  invoiceController.updateInvoice,
);

router.post('/:id/send', validate({ params: idParamSchema }), invoiceController.sendInvoice);

router.post(
  '/:id/void',
  validate({ params: idParamSchema, body: voidInvoiceSchema }),
  invoiceController.voidInvoice,
);

export default router;

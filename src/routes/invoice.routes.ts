import { Router } from 'express';
import * as invoiceController from '../controllers/invoice.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import { listInvoicesQuery } from '../validators/invoice.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('CUSTOMER', 'ADMIN'),
  validate({ query: listInvoicesQuery }),
  invoiceController.listInvoices,
);

router.get(
  '/:id',
  authorize('CUSTOMER', 'ADMIN'),
  validate({ params: idParamSchema }),
  invoiceController.getInvoiceById,
);

export default router;

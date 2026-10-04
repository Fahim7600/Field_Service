import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller';
import { validate } from '../middlewares/validate';
import { listSubscriptionsQuery } from '../validators/subscription.validator';

const router = Router();

router.get(
  '/',
  validate({ query: listSubscriptionsQuery }),
  subscriptionController.listAdminSubscriptions,
);

export default router;

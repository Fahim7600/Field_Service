import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  checkoutSubscriptionSchema,
  subscriptionSessionIdQuerySchema,
} from '../validators/subscription.validator';

const router = Router();

// Public routes (declared BEFORE authenticated routes)
router.get(
  '/success',
  validate({ query: subscriptionSessionIdQuerySchema }),
  subscriptionController.getSuccessStatus,
);
router.get(
  '/cancel',
  validate({ query: subscriptionSessionIdQuerySchema }),
  subscriptionController.getCancelStatus,
);

// Authenticated customer routes
router.post(
  '/checkout',
  authenticate,
  authorize('CUSTOMER'),
  validate({ body: checkoutSubscriptionSchema }),
  subscriptionController.checkout,
);

router.get('/me', authenticate, authorize('CUSTOMER'), subscriptionController.getMySubscription);

router.post(
  '/cancel',
  authenticate,
  authorize('CUSTOMER'),
  subscriptionController.cancelSubscription,
);

export default router;

import { Router } from 'express';
import * as feedbackController from '../controllers/feedback.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { listFeedbackQuery } from '../validators/feedback.validator';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate({ query: listFeedbackQuery }),
  feedbackController.listFeedback,
);

export default router;

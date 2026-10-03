import { Router } from 'express';
import * as techAppController from '../controllers/technician-application.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadSingleImage } from '../middlewares/upload';
import { validate } from '../middlewares/validate';
import { createTechnicianApplicationSchema } from '../validators/technician-application.validator';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize('CUSTOMER'),
  uploadSingleImage('idDocument'),
  validate({ body: createTechnicianApplicationSchema }),
  techAppController.applyAsTechnician,
);

router.get('/me', authenticate, authorize('CUSTOMER'), techAppController.getMyApplication);

export default router;

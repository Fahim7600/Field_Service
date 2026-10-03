import { Router } from 'express';
import * as techAppController from '../controllers/technician-application.controller';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import {
  listTechnicianApplicationsQuerySchema,
  rejectTechnicianApplicationSchema,
} from '../validators/technician-application.validator';

const router = Router();

router.get(
  '/',
  validate({ query: listTechnicianApplicationsQuerySchema }),
  techAppController.listApplications,
);

router.get('/:id', validate({ params: idParamSchema }), techAppController.getApplicationById);

router.patch(
  '/:id/approve',
  validate({ params: idParamSchema }),
  techAppController.approveApplication,
);

router.patch(
  '/:id/reject',
  validate({ params: idParamSchema, body: rejectTechnicianApplicationSchema }),
  techAppController.rejectApplication,
);

router.post(
  '/:id/resend-credentials',
  validate({ params: idParamSchema }),
  techAppController.resendCredentials,
);

export default router;

import { Router } from 'express';
import * as technicianController from '../controllers/technician.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { paginationQuery } from '../validators/common.validator';
import {
  updateTechnicianProfileSchema,
  updateTechnicianSkillsSchema,
} from '../validators/technician.validator';

const router = Router();

router.use(authenticate, authorize('TECHNICIAN'));

router.get(
  '/me/schedule',
  validate({ query: paginationQuery(10, 100) }),
  technicianController.getMySchedule,
);

router.patch(
  '/me/profile',
  validate({ body: updateTechnicianProfileSchema }),
  technicianController.updateProfile,
);

router.put(
  '/me/skills',
  validate({ body: updateTechnicianSkillsSchema }),
  technicianController.updateSkills,
);

export default router;

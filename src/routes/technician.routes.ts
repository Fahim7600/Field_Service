import { Router } from 'express';
import * as technicianController from '../controllers/technician.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  updateTechnicianProfileSchema,
  updateTechnicianSkillsSchema,
} from '../validators/technician.validator';

const router = Router();

router.patch(
  '/me/profile',
  authenticate,
  authorize('TECHNICIAN'),
  validate({ body: updateTechnicianProfileSchema }),
  technicianController.updateProfile,
);

router.put(
  '/me/skills',
  authenticate,
  authorize('TECHNICIAN'),
  validate({ body: updateTechnicianSkillsSchema }),
  technicianController.updateSkills,
);

export default router;

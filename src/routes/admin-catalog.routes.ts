import { Router } from 'express';
import * as catalogController from '../controllers/catalog.controller';
import { validate } from '../middlewares/validate';
import {
  createServiceCategorySchema,
  createSkillSchema,
  updateServiceCategorySchema,
} from '../validators/catalog.validator';
import { idParamSchema } from '../validators/common.validator';

const router = Router();

router.post('/skills', validate({ body: createSkillSchema }), catalogController.createSkill);
router.post(
  '/service-categories',
  validate({ body: createServiceCategorySchema }),
  catalogController.createServiceCategory,
);
router.patch(
  '/service-categories/:id',
  validate({ params: idParamSchema, body: updateServiceCategorySchema }),
  catalogController.updateServiceCategory,
);
router.delete(
  '/service-categories/:id',
  validate({ params: idParamSchema }),
  catalogController.deleteServiceCategory,
);

export default router;

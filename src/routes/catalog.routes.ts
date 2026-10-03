import { Router } from 'express';
import * as catalogController from '../controllers/catalog.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { listQuerySchema } from '../validators/catalog.validator';

const router = Router();

router.get(
  '/skills',
  authenticate,
  validate({ query: listQuerySchema }),
  catalogController.listSkills,
);
router.get(
  '/service-categories',
  authenticate,
  validate({ query: listQuerySchema }),
  catalogController.listServiceCategories,
);

export default router;

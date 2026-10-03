import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { updateMeSchema } from '../validators/user.validator';

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.patch('/me', authenticate, validate({ body: updateMeSchema }), userController.updateMe);

export default router;

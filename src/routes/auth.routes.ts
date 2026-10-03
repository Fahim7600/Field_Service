import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticateForPasswordChange } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', validate({ body: registerSchema }), authController.register);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/refresh-token', validate({ body: refreshTokenSchema }), authController.refreshToken);
router.post(
  '/logout',
  authenticateForPasswordChange,
  validate({ body: refreshTokenSchema }),
  authController.logout,
);
router.patch(
  '/change-password',
  authenticateForPasswordChange,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

export default router;

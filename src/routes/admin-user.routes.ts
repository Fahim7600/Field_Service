import { Router } from 'express';
import * as adminUserController from '../controllers/admin-user.controller';
import { validate } from '../middlewares/validate';
import {
  listUsersQuery,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../validators/admin-user.validator';
import { idParamSchema } from '../validators/common.validator';

const router = Router();

router.get('/', validate({ query: listUsersQuery }), adminUserController.listUsers);

router.patch(
  '/:id/role',
  validate({ params: idParamSchema, body: updateUserRoleSchema }),
  adminUserController.updateUserRole,
);

router.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: updateUserStatusSchema }),
  adminUserController.updateUserStatus,
);

router.delete('/:id', validate({ params: idParamSchema }), adminUserController.deleteUser);

export default router;

import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common.validator';
import { listNotificationsQuery } from '../validators/notification.validator';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate({ query: listNotificationsQuery }),
  notificationController.listNotifications,
);

router.patch('/read-all', notificationController.markAllNotificationsRead);

router.patch(
  '/:id/read',
  validate({ params: idParamSchema }),
  notificationController.markNotificationRead,
);

export default router;

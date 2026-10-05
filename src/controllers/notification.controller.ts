import type { Request, Response } from 'express';
import * as notificationApiService from '../services/notification-api.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { ListNotificationsQuery } from '../validators/notification.validator';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await notificationApiService.listNotifications(
    req.user.id,
    req.query as unknown as ListNotificationsQuery,
  );
  return sendPaginated(res, {
    message: 'Notifications fetched successfully',
    ...result,
  });
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await notificationApiService.markAllNotificationsRead(req.user.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'All notifications marked as read',
    data,
  });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await notificationApiService.markNotificationRead(req.user.id, req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Notification marked as read',
    data,
  });
});

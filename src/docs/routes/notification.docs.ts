import { z } from 'zod';
import { idParamSchema } from '../../validators/common.validator';
import { listNotificationsQuery } from '../../validators/notification.validator';
import { commonErrorResponses, paginatedResponseSchema, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerNotificationDocs = () => {
  registerRoute({
    method: 'get',
    path: '/api/v1/notifications',
    summary: 'List user notifications',
    description:
      'Retrieves in-app notifications for the authenticated user. Role: Customer, Technician, Admin.',
    tags: ['Notifications'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listNotificationsQuery,
    },
    responses: {
      200: {
        description: 'Notifications retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                title: z.string(),
                message: z.string(),
                isRead: z.boolean(),
                createdAt: z.string(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'patch',
    path: '/api/v1/notifications/read-all',
    summary: 'Mark all notifications as read',
    description:
      'Marks all unread notifications as read for current user. Role: Customer, Technician, Admin.',
    tags: ['Notifications'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'All notifications marked as read',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ count: z.number() })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'patch',
    path: '/api/v1/notifications/{id}/read',
    summary: 'Mark single notification as read',
    description: 'Marks a specific notification as read. Role: Customer, Technician, Admin.',
    tags: ['Notifications'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Notification marked as read',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string(), isRead: z.literal(true) })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

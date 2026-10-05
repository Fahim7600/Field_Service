import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type { ListNotificationsQuery } from '../validators/notification.validator';

export const listNotifications = async (userId: string, query: ListNotificationsQuery) => {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, items, unreadCount] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
  ]);

  return {
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
    total,
    page: query.page,
    limit: query.limit,
    extra: { unreadCount },
  };
};

export const markAllNotificationsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return { updated: result.count };
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (notification.isRead) {
    return {
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      },
    };
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return {
    notification: {
      id: updated.id,
      type: updated.type,
      title: updated.title,
      message: updated.message,
      data: updated.data,
      isRead: updated.isRead,
      createdAt: updated.createdAt,
    },
  };
};

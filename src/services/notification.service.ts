import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

export interface NotifyAdminsParams {
  type: string;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

export const createNotification = async (
  { userId, type, title, message, data }: CreateNotificationParams,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  return client.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ?? undefined,
    },
  });
};

export const notifyAdmins = async (
  { type, title, message, data }: NotifyAdminsParams,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: { id: true },
  });

  if (admins.length > 0) {
    await client.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type,
        title,
        message,
        data: data ?? undefined,
      })),
    });
  }
};

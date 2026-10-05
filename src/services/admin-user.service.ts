import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type {
  ListUsersQuery,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from '../validators/admin-user.validator';
import { writeAuditLog } from './audit.service';
import { createNotification } from './notification.service';
import { getPremiumStatus, invalidatePremiumCache } from './premium.service';

const hasUnfinishedWork = async (
  tx: Prisma.TransactionClient,
  user: { id: string; role: Role },
): Promise<boolean> => {
  if (user.role === 'CUSTOMER') {
    const [openWO, openSR] = await Promise.all([
      tx.workOrder.findFirst({
        where: {
          customerId: user.id,
          deletedAt: null,
          status: { notIn: ['CLOSED', 'CANCELLED'] },
        },
      }),
      tx.serviceRequest.findFirst({
        where: {
          customerId: user.id,
          status: 'SUBMITTED',
          deletedAt: null,
        },
      }),
    ]);
    return Boolean(openWO || openSR);
  }

  if (user.role === 'TECHNICIAN') {
    const activeWO = await tx.workOrder.findFirst({
      where: {
        technicianId: user.id,
        deletedAt: null,
        status: { in: ['ASSIGNED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS'] },
      },
    });
    return Boolean(activeWO);
  }

  return false;
};

export const listUsers = async (query: ListUsersQuery) => {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
  };
};

export const updateUserRole = async (
  admin: { id: string; ip?: string },
  targetId: string,
  input: UpdateUserRoleInput,
) => {
  if (targetId === admin.id) {
    throw new ApiError(409, 'You cannot change your own account');
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: targetId, deletedAt: null },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.role === input.role) {
      throw new ApiError(409, 'User already has this role');
    }

    if (user.role === 'CUSTOMER') {
      const [unfinished, premium] = await Promise.all([
        hasUnfinishedWork(tx, user),
        getPremiumStatus(user.id),
      ]);
      if (unfinished || premium.isPremium) {
        throw new ApiError(409, 'User has unfinished jobs or an active premium subscription');
      }
    } else if (user.role === 'TECHNICIAN') {
      const unfinished = await hasUnfinishedWork(tx, user);
      if (unfinished) {
        throw new ApiError(409, 'User has unfinished jobs');
      }
    }

    const now = new Date();
    const updated = await tx.user.update({
      where: { id: targetId },
      data: { role: input.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    await tx.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: now },
    });

    if (input.role === 'CUSTOMER') {
      await tx.customerProfile.upsert({
        where: { userId: targetId },
        update: { deletedAt: null },
        create: { userId: targetId },
      });
      await tx.technicianProfile.updateMany({
        where: { userId: targetId },
        data: { deletedAt: now, isActive: false },
      });
    } else if (input.role === 'TECHNICIAN') {
      await tx.technicianProfile.upsert({
        where: { userId: targetId },
        update: { deletedAt: null, isActive: true },
        create: { userId: targetId, isActive: true },
      });
      await tx.customerProfile.updateMany({
        where: { userId: targetId },
        data: { deletedAt: now },
      });
    }

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: 'USER_ROLE_CHANGED',
      entity: 'User',
      entityId: targetId,
      oldValues: { role: user.role },
      newValues: { role: input.role },
      ipAddress: admin.ip,
    });

    await createNotification(
      {
        userId: targetId,
        type: 'ROLE_CHANGED',
        title: 'Role updated',
        message: `Your role has been updated to ${input.role}`,
        data: { role: input.role },
      },
      tx,
    );

    await invalidatePremiumCache(targetId);

    return { user: updated };
  });
};

export const updateUserStatus = async (
  admin: { id: string; ip?: string },
  targetId: string,
  input: UpdateUserStatusInput,
) => {
  if (targetId === admin.id) {
    throw new ApiError(409, 'You cannot change your own account');
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: targetId, deletedAt: null },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.status === input.status) {
      throw new ApiError(409, 'User already has this status');
    }

    const now = new Date();
    const updated = await tx.user.update({
      where: { id: targetId },
      data: { status: input.status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (input.status === 'SUSPENDED') {
      await tx.refreshToken.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: now },
      });
    }

    const action = input.status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_ACTIVATED';

    await writeAuditLog(tx, {
      actorId: admin.id,
      action,
      entity: 'User',
      entityId: targetId,
      oldValues: { status: user.status },
      newValues: { status: input.status },
      ipAddress: admin.ip,
    });

    return { user: updated };
  });
};

export const deleteUser = async (admin: { id: string; ip?: string }, targetId: string) => {
  if (targetId === admin.id) {
    throw new ApiError(409, 'You cannot change your own account');
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: targetId, deletedAt: null },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const unfinished = await hasUnfinishedWork(tx, user);
    if (unfinished) {
      throw new ApiError(409, 'User has unfinished jobs');
    }

    const now = new Date();
    await tx.user.update({
      where: { id: targetId },
      data: { deletedAt: now },
    });

    await tx.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: now },
    });

    await tx.customerProfile.updateMany({
      where: { userId: targetId },
      data: { deletedAt: now },
    });

    await tx.technicianProfile.updateMany({
      where: { userId: targetId },
      data: { deletedAt: now, isActive: false },
    });

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: 'USER_DELETED',
      entity: 'User',
      entityId: targetId,
      oldValues: { id: user.id, email: user.email, role: user.role },
      ipAddress: admin.ip,
    });

    await invalidatePremiumCache(targetId);

    return {};
  });
};

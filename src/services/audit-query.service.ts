import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { ListAuditLogsQuery } from '../validators/audit.validator';

export const listAuditLogs = async (query: ListAuditLogsQuery) => {
  let dateGte: Date | undefined;
  let dateLte: Date | undefined;

  if (query.dateFrom) {
    dateGte = new Date(query.dateFrom);
  }

  if (query.dateTo) {
    if (query.dateTo.length === 10) {
      dateLte = new Date(`${query.dateTo}T23:59:59.999Z`);
    } else {
      dateLte = new Date(query.dateTo);
    }
  }

  const where: Prisma.AuditLogWhereInput = {
    ...(query.userId ? { actorId: query.userId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.entity ? { entity: query.entity } : {}),
    ...(dateGte || dateLte
      ? {
          createdAt: {
            ...(dateGte ? { gte: dateGte } : {}),
            ...(dateLte ? { lte: dateLte } : {}),
          },
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      oldValues: a.oldValues,
      newValues: a.newValues,
      ipAddress: a.ipAddress,
      createdAt: a.createdAt,
      actor: a.actor
        ? {
            id: a.actor.id,
            name: a.actor.name,
            email: a.actor.email,
          }
        : null,
    })),
    total,
    page: query.page,
    limit: query.limit,
  };
};

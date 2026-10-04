import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface WriteAuditLogParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

export const writeAuditLog = async (
  client: Prisma.TransactionClient | typeof prisma = prisma,
  { actorId, action, entity, entityId, oldValues, newValues, ipAddress }: WriteAuditLogParams,
) => {
  return client.auditLog.create({
    data: {
      actorId: actorId ?? undefined,
      action,
      entity,
      entityId: entityId ?? undefined,
      oldValues: oldValues ?? undefined,
      newValues: newValues ?? undefined,
      ipAddress: ipAddress ?? undefined,
    },
  });
};

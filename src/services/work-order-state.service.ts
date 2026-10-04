import type { Prisma, Role, WorkOrderStatus } from '@prisma/client';
import { ApiError } from '../utils/apiError';
import { writeAuditLog } from './audit.service';

export const ACTIVE_VISIT_STATUSES: WorkOrderStatus[] = ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS'];

export type ActorRole = Role | 'SYSTEM';

interface TransitionRule {
  from: WorkOrderStatus;
  to: WorkOrderStatus;
  roles: ActorRole[];
}

const TRANSITIONS: TransitionRule[] = [
  { from: 'APPROVED', to: 'ASSIGNED', roles: ['ADMIN'] },
  { from: 'ASSIGNED', to: 'APPROVED', roles: ['TECHNICIAN'] },
  { from: 'ASSIGNED', to: 'SCHEDULED', roles: ['ADMIN'] },
  { from: 'SCHEDULED', to: 'ARRIVED', roles: ['TECHNICIAN'] },
  { from: 'ARRIVED', to: 'IN_PROGRESS', roles: ['TECHNICIAN'] },
  { from: 'IN_PROGRESS', to: 'COMPLETED', roles: ['TECHNICIAN'] },
  { from: 'APPROVED', to: 'CANCELLED', roles: ['CUSTOMER', 'ADMIN'] },
  { from: 'ASSIGNED', to: 'CANCELLED', roles: ['CUSTOMER', 'ADMIN'] },
  { from: 'SCHEDULED', to: 'CANCELLED', roles: ['CUSTOMER', 'ADMIN'] },
  { from: 'COMPLETED', to: 'INVOICED', roles: ['ADMIN'] },
  { from: 'INVOICED', to: 'COMPLETED', roles: ['ADMIN'] },
  { from: 'INVOICED', to: 'PAID', roles: ['SYSTEM'] },
  { from: 'PAID', to: 'CLOSED', roles: ['SYSTEM'] },
];

export interface TransitionWorkOrderParams {
  workOrderId: string;
  to: WorkOrderStatus;
  actor: {
    id: string;
    role: ActorRole;
    ip?: string;
  };
  note?: string;
  data?: Prisma.WorkOrderUncheckedUpdateInput;
}

export const transitionWorkOrder = async (
  tx: Prisma.TransactionClient,
  { workOrderId, to, actor, note, data }: TransitionWorkOrderParams,
) => {
  const workOrder = await tx.workOrder.findFirst({
    where: { id: workOrderId, deletedAt: null },
    select: { id: true, status: true },
  });

  if (!workOrder) {
    throw new ApiError(404, 'Work order not found');
  }

  const from = workOrder.status;
  const rule = TRANSITIONS.find((t) => t.from === from && t.to === to);

  if (!rule) {
    throw new ApiError(409, `Cannot move a work order from ${from} to ${to}`);
  }

  if (!rule.roles.includes(actor.role)) {
    throw new ApiError(403, 'You do not have permission to make this status change');
  }

  const { count } = await tx.workOrder.updateMany({
    where: { id: workOrderId, status: from, deletedAt: null },
    data: {
      status: to,
      ...(data ?? {}),
    },
  });

  if (count !== 1) {
    throw new ApiError(409, 'Work order status changed, please try again');
  }

  await tx.workOrderStatusHistory.create({
    data: {
      workOrderId,
      fromStatus: from,
      toStatus: to,
      changedById: actor.id,
      note: note ?? undefined,
    },
  });

  const extraData =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};

  await writeAuditLog(tx, {
    actorId: actor.id,
    action: 'WORK_ORDER_STATUS_CHANGED',
    entity: 'WorkOrder',
    entityId: workOrderId,
    oldValues: { status: from },
    newValues: {
      status: to,
      ...extraData,
    } as Prisma.InputJsonValue,
    ipAddress: actor.ip,
  });

  return tx.workOrder.findUniqueOrThrow({
    where: { id: workOrderId },
  });
};

export interface RecordWorkOrderEventParams {
  workOrderId: string;
  status: WorkOrderStatus;
  actor: {
    id: string;
    role: ActorRole;
    ip?: string;
  };
  note?: string;
  action: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
}

export const recordWorkOrderEvent = async (
  tx: Prisma.TransactionClient,
  { workOrderId, status, actor, note, action, oldValues, newValues }: RecordWorkOrderEventParams,
) => {
  await tx.workOrderStatusHistory.create({
    data: {
      workOrderId,
      fromStatus: status,
      toStatus: status,
      changedById: actor.id,
      note: note ?? undefined,
    },
  });

  await writeAuditLog(tx, {
    actorId: actor.id,
    action,
    entity: 'WorkOrder',
    entityId: workOrderId,
    oldValues,
    newValues: (newValues ?? {
      status,
      ...(note ? { note } : {}),
    }) as Prisma.InputJsonValue,
    ipAddress: actor.ip,
  });
};

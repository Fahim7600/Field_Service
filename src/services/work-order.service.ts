import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type {
  AssignTechnicianInput,
  ListWorkOrdersQuery,
  RejectWorkOrderInput,
  ScheduleWorkOrderInput,
} from '../validators/work-order.validator';
import { createNotification, notifyAdmins } from './notification.service';
import { formatServiceRequestDetail } from './service-request.service';
import {
  ACTIVE_VISIT_STATUSES,
  recordWorkOrderEvent,
  transitionWorkOrder,
} from './work-order-state.service';

type WorkOrderSummaryRow = Prisma.WorkOrderGetPayload<{
  include: {
    customer: true;
    technician: true;
    serviceRequest: {
      include: {
        category: true;
      };
    };
  };
}>;

type WorkOrderDetailRow = Prisma.WorkOrderGetPayload<{
  include: {
    customer: true;
    technician: true;
    serviceRequest: {
      include: {
        category: true;
        customer: true;
        attachments: true;
        workOrder: true;
      };
    };
  };
}>;

export const formatWorkOrderSummary = (wo: WorkOrderSummaryRow) => {
  return {
    id: wo.id,
    status: wo.status,
    visitStart: wo.visitStart,
    visitEnd: wo.visitEnd,
    acceptedAt: wo.acceptedAt,
    createdAt: wo.createdAt,
    request: {
      id: wo.serviceRequest.id,
      requestNumber: wo.serviceRequest.requestNumber,
      title: wo.serviceRequest.title,
      priority: wo.serviceRequest.priority,
      category: {
        id: wo.serviceRequest.category.id,
        name: wo.serviceRequest.category.name,
      },
    },
    customer: {
      id: wo.customer.id,
      name: wo.customer.name,
    },
    technician: wo.technician
      ? {
          id: wo.technician.id,
          name: wo.technician.name,
        }
      : null,
  };
};

export const formatWorkOrderDetail = (wo: WorkOrderDetailRow, viewerRole?: Role) => {
  const summary = formatWorkOrderSummary(wo);
  return {
    ...summary,
    arrivedAt: wo.arrivedAt,
    startedAt: wo.startedAt,
    completedAt: wo.completedAt,
    cancelledAt: wo.cancelledAt,
    cancelReason: wo.cancelReason,
    request: formatServiceRequestDetail(wo.serviceRequest, viewerRole),
  };
};

export const assignTechnician = async (
  admin: { id: string; role: Role; ip?: string },
  workOrderId: string,
  input: AssignTechnicianInput,
) => {
  return prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findFirst({
      where: { id: workOrderId, deletedAt: null },
      include: {
        serviceRequest: {
          include: {
            category: true,
          },
        },
        customer: true,
      },
    });

    if (!workOrder) {
      throw new ApiError(404, 'Work order not found');
    }

    const technician = await tx.user.findFirst({
      where: {
        id: input.technicianId,
        role: 'TECHNICIAN',
        deletedAt: null,
      },
      include: {
        technicianProfile: {
          include: {
            skills: true,
          },
        },
      },
    });

    if (!technician) {
      throw new ApiError(404, 'Technician not found');
    }

    const hasSkill =
      technician.technicianProfile?.skills.some(
        (ts) => ts.skillId === workOrder.serviceRequest.category.skillId,
      ) ?? false;

    if (
      technician.status !== 'ACTIVE' ||
      !technician.technicianProfile?.isActive ||
      technician.technicianProfile.deletedAt !== null ||
      !hasSkill
    ) {
      throw new ApiError(422, 'Technician is not eligible for this service');
    }

    await transitionWorkOrder(tx, {
      workOrderId,
      to: 'ASSIGNED',
      actor: { id: admin.id, role: 'ADMIN', ip: admin.ip },
      data: {
        technicianId: input.technicianId,
        acceptedAt: null,
      },
      note: `Assigned to ${technician.name}`,
    });

    await createNotification(
      {
        userId: input.technicianId,
        type: 'WORK_ORDER_ASSIGNED',
        title: 'New work order assigned',
        message: `You have been assigned to work order for request ${workOrder.serviceRequest.requestNumber}`,
        data: { workOrderId },
      },
      tx,
    );

    const fullWo = await tx.workOrder.findUniqueOrThrow({
      where: { id: workOrderId },
      include: {
        customer: true,
        technician: true,
        serviceRequest: {
          include: {
            category: true,
          },
        },
      },
    });

    return formatWorkOrderSummary(fullWo);
  });
};

export const acceptWorkOrder = async (
  technician: { id: string; role: Role; ip?: string },
  workOrderId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findFirst({
      where: { id: workOrderId, deletedAt: null },
      include: {
        serviceRequest: true,
      },
    });

    if (!workOrder || workOrder.technicianId !== technician.id) {
      throw new ApiError(404, 'Work order not found');
    }

    if (workOrder.status !== 'ASSIGNED' || workOrder.acceptedAt !== null) {
      throw new ApiError(409, 'Job is not waiting for acceptance');
    }

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        acceptedAt: new Date(),
      },
    });

    await recordWorkOrderEvent(tx, {
      workOrderId,
      status: 'ASSIGNED',
      actor: { id: technician.id, role: 'TECHNICIAN', ip: technician.ip },
      note: 'Accepted by technician',
      action: 'WORK_ORDER_ACCEPTED',
    });

    await notifyAdmins(
      {
        type: 'JOB_ACCEPTED',
        title: 'Job accepted',
        message: `Technician accepted work order for request ${workOrder.serviceRequest.requestNumber}`,
        data: { workOrderId },
      },
      tx,
    );
  });
};

export const rejectWorkOrder = async (
  technician: { id: string; role: Role; ip?: string },
  workOrderId: string,
  input: RejectWorkOrderInput,
) => {
  return prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findFirst({
      where: { id: workOrderId, deletedAt: null },
      include: {
        serviceRequest: true,
      },
    });

    if (!workOrder || workOrder.technicianId !== technician.id) {
      throw new ApiError(404, 'Work order not found');
    }

    if (workOrder.status !== 'ASSIGNED' || workOrder.acceptedAt !== null) {
      throw new ApiError(409, 'Job is not waiting for acceptance');
    }

    await transitionWorkOrder(tx, {
      workOrderId,
      to: 'APPROVED',
      actor: { id: technician.id, role: 'TECHNICIAN', ip: technician.ip },
      data: {
        technicianId: null,
        acceptedAt: null,
      },
      note: input.reason,
    });

    await notifyAdmins(
      {
        type: 'JOB_REJECTED',
        title: 'Job rejected',
        message: `Work order for request ${workOrder.serviceRequest.requestNumber} was rejected: ${input.reason}`,
        data: { workOrderId, reason: input.reason },
      },
      tx,
    );
  });
};

export const scheduleWorkOrder = async (
  admin: { id: string; role: Role; ip?: string },
  workOrderId: string,
  input: ScheduleWorkOrderInput,
) => {
  return prisma.$transaction(
    async (tx) => {
      const workOrder = await tx.workOrder.findFirst({
        where: { id: workOrderId, deletedAt: null },
      });

      if (!workOrder) {
        throw new ApiError(404, 'Work order not found');
      }

      if (!workOrder.technicianId) {
        throw new ApiError(409, 'No technician is assigned yet');
      }

      // Lock the technician row
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${workOrder.technicianId} FOR UPDATE`;

      // Re-read work order AFTER the lock
      const lockedWo = await tx.workOrder.findFirstOrThrow({
        where: { id: workOrderId, deletedAt: null },
        include: {
          technician: true,
          serviceRequest: {
            include: {
              category: true,
            },
          },
          customer: true,
        },
      });

      if (lockedWo.status !== 'ASSIGNED' || lockedWo.acceptedAt === null) {
        throw new ApiError(409, 'Work order must be ASSIGNED and accepted by the technician');
      }

      if (lockedWo.technician?.status !== 'ACTIVE' || lockedWo.technician?.deletedAt !== null) {
        throw new ApiError(409, 'Technician account is not active');
      }

      // Conflict check
      const conflict = await tx.workOrder.findFirst({
        where: {
          id: { not: workOrderId },
          technicianId: workOrder.technicianId,
          deletedAt: null,
          status: { in: ACTIVE_VISIT_STATUSES },
          visitStart: { lt: input.visitEnd },
          visitEnd: { gt: input.visitStart },
        },
      });

      if (conflict) {
        throw new ApiError(409, 'Technician already has a visit in this time window', [
          { field: 'visitStart', message: 'Time window conflicts with another visit' },
        ]);
      }

      await transitionWorkOrder(tx, {
        workOrderId,
        to: 'SCHEDULED',
        actor: { id: admin.id, role: 'ADMIN', ip: admin.ip },
        data: {
          visitStart: input.visitStart,
          visitEnd: input.visitEnd,
        },
        note: `Scheduled visit from ${input.visitStart.toISOString()} to ${input.visitEnd.toISOString()}`,
      });

      await createNotification(
        {
          userId: lockedWo.customerId,
          type: 'VISIT_SCHEDULED',
          title: 'Visit scheduled',
          message: `Visit scheduled for ${input.visitStart.toISOString()}`,
          data: { workOrderId, visitStart: input.visitStart, visitEnd: input.visitEnd },
        },
        tx,
      );

      await createNotification(
        {
          userId: workOrder.technicianId,
          type: 'VISIT_SCHEDULED',
          title: 'Visit scheduled',
          message: `Visit scheduled for ${input.visitStart.toISOString()}`,
          data: { workOrderId, visitStart: input.visitStart, visitEnd: input.visitEnd },
        },
        tx,
      );

      const scheduledWo = await tx.workOrder.findUniqueOrThrow({
        where: { id: workOrderId },
        include: {
          customer: true,
          technician: true,
          serviceRequest: {
            include: {
              category: true,
            },
          },
        },
      });

      return formatWorkOrderSummary(scheduledWo);
    },
    { timeout: 20000, maxWait: 20000 },
  );
};

export const listWorkOrders = async (
  user: { id: string; role: Role },
  query: ListWorkOrdersQuery,
) => {
  const where: Prisma.WorkOrderWhereInput = {
    deletedAt: null,
    ...(user.role === 'CUSTOMER' ? { customerId: user.id } : {}),
    ...(user.role === 'TECHNICIAN' ? { technicianId: user.id } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      include: {
        customer: true,
        technician: true,
        serviceRequest: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        [query.sortBy]: query.order,
      },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map(formatWorkOrderSummary),
    total,
    page: query.page,
    limit: query.limit,
  };
};

export const getMyAssigned = async (
  technicianId: string,
  query: { page: number; limit: number },
) => {
  const where: Prisma.WorkOrderWhereInput = {
    technicianId,
    deletedAt: null,
    status: { in: ['ASSIGNED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS'] },
  };

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      include: {
        customer: true,
        technician: true,
        serviceRequest: {
          include: {
            category: true,
          },
        },
      },
      orderBy: [{ visitStart: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map(formatWorkOrderSummary),
    total,
    page: query.page,
    limit: query.limit,
  };
};

export const getWorkOrderById = async (user: { id: string; role: Role }, id: string) => {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      technician: true,
      serviceRequest: {
        include: {
          category: true,
          customer: true,
          attachments: {
            where: { deletedAt: null },
          },
          workOrder: true,
        },
      },
    },
  });

  if (!workOrder) {
    throw new ApiError(404, 'Work order not found');
  }

  if (user.role === 'ADMIN') {
    // Admin can view any work order
  } else if (user.role === 'CUSTOMER') {
    if (workOrder.customerId !== user.id) {
      throw new ApiError(404, 'Work order not found');
    }
  } else if (user.role === 'TECHNICIAN') {
    if (workOrder.technicianId !== user.id) {
      throw new ApiError(404, 'Work order not found');
    }
  } else {
    throw new ApiError(404, 'Work order not found');
  }

  return formatWorkOrderDetail(workOrder, user.role);
};

export const getWorkOrderHistory = async (
  user: { id: string; role: Role },
  id: string,
  query: { page: number; limit: number },
) => {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id, deletedAt: null },
  });

  if (!workOrder) {
    throw new ApiError(404, 'Work order not found');
  }

  if (user.role === 'ADMIN') {
    // Allowed
  } else if (user.role === 'CUSTOMER') {
    if (workOrder.customerId !== user.id) {
      throw new ApiError(404, 'Work order not found');
    }
  } else if (user.role === 'TECHNICIAN') {
    if (workOrder.technicianId !== user.id) {
      throw new ApiError(404, 'Work order not found');
    }
  } else {
    throw new ApiError(404, 'Work order not found');
  }

  const where = { workOrderId: id };
  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.workOrderStatusHistory.count({ where }),
    prisma.workOrderStatusHistory.findMany({
      where,
      include: {
        changedBy: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      changedBy: {
        id: h.changedBy.id,
        name: h.changedBy.name,
        role: h.changedBy.role,
      },
      createdAt: h.createdAt,
    })),
    total,
    page: query.page,
    limit: query.limit,
  };
};

export const getTechnicianSchedule = async (
  technicianId: string,
  query: { page: number; limit: number },
) => {
  const where: Prisma.WorkOrderWhereInput = {
    technicianId,
    deletedAt: null,
    status: { in: ACTIVE_VISIT_STATUSES },
    visitEnd: { gt: new Date() },
  };

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      include: {
        customer: true,
        technician: true,
        serviceRequest: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        visitStart: 'asc',
      },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map(formatWorkOrderSummary),
    total,
    page: query.page,
    limit: query.limit,
  };
};

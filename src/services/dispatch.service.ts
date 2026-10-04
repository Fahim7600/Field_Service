import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type {
  AvailableTechniciansQuery,
  DispatchQueueQuery,
  ReviewServiceRequestInput,
} from '../validators/dispatch.validator';
import { writeAuditLog } from './audit.service';
import { createNotification } from './notification.service';
import { ACTIVE_VISIT_STATUSES } from './work-order-state.service';

interface DispatchQueueItem {
  type: 'REQUEST_REVIEW' | 'NEEDS_TECHNICIAN';
  id: string;
  requestId: string;
  requestNumber: string;
  title: string;
  priority: 'NORMAL' | 'HIGH';
  reviewDueAt: Date;
  isLate: boolean;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
  };
  category: {
    id: string;
    name: string;
  };
  returned: {
    reason: string | null;
    technician: {
      id: string;
      name: string;
    };
    at: Date;
  } | null;
}

export const getDispatchQueue = async (query: DispatchQueueQuery) => {
  let requestItems: DispatchQueueItem[] = [];
  let workOrderItems: DispatchQueueItem[] = [];

  if (!query.type || query.type === 'REQUEST_REVIEW') {
    const requests = await prisma.serviceRequest.findMany({
      where: {
        status: 'SUBMITTED',
        deletedAt: null,
      },
      include: {
        customer: true,
        category: true,
      },
    });

    requestItems = requests.map((req) => ({
      type: 'REQUEST_REVIEW' as const,
      id: req.id,
      requestId: req.id,
      requestNumber: req.requestNumber,
      title: req.title,
      priority: req.priority,
      reviewDueAt: req.reviewDueAt,
      isLate: req.status === 'SUBMITTED' && new Date(req.reviewDueAt) < new Date(),
      createdAt: req.createdAt,
      customer: { id: req.customer.id, name: req.customer.name },
      category: { id: req.category.id, name: req.category.name },
      returned: null,
    }));
  }

  if (!query.type || query.type === 'NEEDS_TECHNICIAN') {
    const workOrders = await prisma.workOrder.findMany({
      where: {
        status: 'APPROVED',
        technicianId: null,
        deletedAt: null,
      },
      include: {
        customer: true,
        serviceRequest: {
          include: {
            category: true,
          },
        },
        statusHistory: {
          where: {
            fromStatus: 'ASSIGNED',
            toStatus: 'APPROVED',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            changedBy: true,
          },
        },
      },
    });

    workOrderItems = workOrders.map((wo) => {
      const latestReturn = wo.statusHistory[0];
      return {
        type: 'NEEDS_TECHNICIAN' as const,
        id: wo.id,
        requestId: wo.serviceRequest.id,
        requestNumber: wo.serviceRequest.requestNumber,
        title: wo.serviceRequest.title,
        priority: wo.serviceRequest.priority,
        reviewDueAt: wo.serviceRequest.reviewDueAt,
        isLate: false,
        createdAt: wo.serviceRequest.createdAt,
        customer: { id: wo.customer.id, name: wo.customer.name },
        category: { id: wo.serviceRequest.category.id, name: wo.serviceRequest.category.name },
        returned: latestReturn
          ? {
              reason: latestReturn.note ?? null,
              technician: {
                id: latestReturn.changedBy.id,
                name: latestReturn.changedBy.name,
              },
              at: latestReturn.createdAt,
            }
          : null,
      };
    });
  }

  const allItems: DispatchQueueItem[] = [...requestItems, ...workOrderItems];

  allItems.sort((a, b) => {
    if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
    if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const total = allItems.length;
  const skip = (query.page - 1) * query.limit;
  const items = allItems.slice(skip, skip + query.limit);

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
  };
};

export const reviewServiceRequest = async (
  adminId: string,
  id: string,
  input: ReviewServiceRequestInput,
  ip?: string,
) => {
  return prisma.$transaction(async (tx) => {
    const request = await tx.serviceRequest.findFirst({
      where: { id, deletedAt: null },
    });

    if (!request) {
      throw new ApiError(404, 'Service request not found');
    }

    const { count } = await tx.serviceRequest.updateMany({
      where: { id, status: 'SUBMITTED', deletedAt: null },
      data: {
        status: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: input.decision === 'REJECT' ? input.reason : null,
      },
    });

    if (count === 0) {
      throw new ApiError(409, 'Request is already reviewed');
    }

    let workOrder = null;

    if (input.decision === 'APPROVE') {
      workOrder = await tx.workOrder.create({
        data: {
          serviceRequestId: id,
          customerId: request.customerId,
          status: 'APPROVED',
        },
      });

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: workOrder.id,
          fromStatus: null,
          toStatus: 'APPROVED',
          changedById: adminId,
          note: 'Request approved',
        },
      });

      await createNotification(
        {
          userId: request.customerId,
          type: 'REQUEST_APPROVED',
          title: 'Service request approved',
          message: 'Your service request has been approved',
          data: { serviceRequestId: id, workOrderId: workOrder.id },
        },
        tx,
      );
    } else {
      await createNotification(
        {
          userId: request.customerId,
          type: 'REQUEST_REJECTED',
          title: 'Service request rejected',
          message: `Your service request was rejected: ${input.reason}`,
          data: { serviceRequestId: id, reason: input.reason },
        },
        tx,
      );
    }

    await writeAuditLog(tx, {
      actorId: adminId,
      action: 'SERVICE_REQUEST_REVIEWED',
      entity: 'ServiceRequest',
      entityId: id,
      newValues: { decision: input.decision, reason: input.reason ?? null },
      ipAddress: ip,
    });

    return {
      request: {
        id: request.id,
        requestNumber: request.requestNumber,
        status: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      },
      workOrder: workOrder
        ? {
            id: workOrder.id,
            status: workOrder.status,
          }
        : null,
    };
  });
};

type AvailableTechnicianRow = Prisma.UserGetPayload<{
  include: {
    technicianProfile: {
      include: {
        skills: {
          include: {
            skill: true;
          };
        };
      };
    };
  };
}>;

export const getAvailableTechnicians = async (query: AvailableTechniciansQuery) => {
  const skill = await prisma.skill.findFirst({
    where: { id: query.skillId },
  });

  if (!skill) {
    throw new ApiError(404, 'Skill not found');
  }

  const technicians: AvailableTechnicianRow[] = await prisma.user.findMany({
    where: {
      role: 'TECHNICIAN',
      status: 'ACTIVE',
      deletedAt: null,
      technicianProfile: {
        isActive: true,
        deletedAt: null,
        skills: {
          some: {
            skillId: query.skillId,
          },
        },
      },
      technicianWorkOrders: {
        none: {
          deletedAt: null,
          status: { in: ACTIVE_VISIT_STATUSES },
          visitStart: { lt: query.end },
          visitEnd: { gt: query.start },
        },
      },
    },
    include: {
      technicianProfile: {
        include: {
          skills: {
            include: {
              skill: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  const allItems = technicians.map((tech) => ({
    id: tech.id,
    name: tech.name,
    serviceArea: tech.technicianProfile?.serviceArea ?? null,
    yearsOfExperience: tech.technicianProfile?.yearsOfExperience ?? 0,
    skills: (tech.technicianProfile?.skills || []).map((ts) => ({
      id: ts.skill.id,
      name: ts.skill.name,
    })),
  }));

  const total = allItems.length;
  const skip = (query.page - 1) * query.limit;
  const items = allItems.slice(skip, skip + query.limit);

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
  };
};

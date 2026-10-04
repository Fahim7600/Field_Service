import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type {
  CreateServiceRequestInput,
  ListServiceRequestsQuery,
  SearchServiceRequestsQuery,
} from '../validators/service-request.validator';
import { getPremiumStatus } from './premium.service';
import { getSignedImageUrl } from './upload.service';

type ServiceRequestDetailRow = Prisma.ServiceRequestGetPayload<{
  include: {
    category: true;
    customer: true;
    attachments: true;
    workOrder: true;
  };
}>;

type ServiceRequestListRow = Prisma.ServiceRequestGetPayload<{
  include: {
    category: true;
    customer: true;
    _count: {
      select: {
        attachments: true;
      };
    };
  };
}>;

export const generateRequestNumber = async (tx: Prisma.TransactionClient): Promise<string> => {
  const result = await tx.$queryRaw<
    Array<{ nextval: bigint | number | string }>
  >`SELECT nextval('service_request_number_seq') AS nextval`;
  if (!result || result.length === 0) {
    throw new Error('Failed to generate request number');
  }
  const seqNumber = Number(result[0].nextval);
  const year = new Date().getUTCFullYear();
  const padded = String(seqNumber).padStart(6, '0');
  return `SR-${year}-${padded}`;
};

export const formatServiceRequestDetail = (
  request: ServiceRequestDetailRow,
  viewerRole?: string,
) => {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    status: request.status,
    priority: request.priority,
    title: request.title,
    description: request.description,
    address: request.address,
    preferredAt: request.preferredAt,
    reviewDueAt: request.reviewDueAt,
    isReviewOverdue: request.status === 'SUBMITTED' && new Date(request.reviewDueAt) < new Date(),
    rejectionReason: request.rejectionReason,
    reviewedAt: request.reviewedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    category: {
      id: request.category.id,
      name: request.category.name,
    },
    customer: {
      id: request.customer.id,
      name: request.customer.name,
      ...(viewerRole === 'ADMIN' ? { email: request.customer.email } : {}),
    },
    attachments: (request.attachments || [])
      .filter((a) => a.deletedAt === null)
      .map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        url: getSignedImageUrl(a.publicId, a.url),
        createdAt: a.createdAt,
      })),
    workOrder: request.workOrder
      ? {
          id: request.workOrder.id,
          status: request.workOrder.status,
        }
      : null,
  };
};

export const formatServiceRequestListItem = (request: ServiceRequestListRow) => {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    status: request.status,
    priority: request.priority,
    title: request.title,
    preferredAt: request.preferredAt,
    reviewDueAt: request.reviewDueAt,
    isReviewOverdue: request.status === 'SUBMITTED' && new Date(request.reviewDueAt) < new Date(),
    createdAt: request.createdAt,
    category: {
      id: request.category.id,
      name: request.category.name,
    },
    customer: {
      id: request.customer.id,
      name: request.customer.name,
    },
    attachmentCount: request._count?.attachments ?? 0,
  };
};

export const createServiceRequest = async (
  customerId: string,
  input: CreateServiceRequestInput,
) => {
  const category = await prisma.serviceCategory.findFirst({
    where: { id: input.categoryId, deletedAt: null },
  });
  if (!category) {
    throw new ApiError(404, 'Service category not found');
  }

  const premium = await getPremiumStatus(customerId);
  const priority = premium.isPremium ? 'HIGH' : 'NORMAL';
  const reviewDueAt = new Date(Date.now() + (premium.isPremium ? 2 : 24) * 60 * 60 * 1000);

  const request = await prisma.$transaction(async (tx) => {
    const requestNumber = await generateRequestNumber(tx);
    return tx.serviceRequest.create({
      data: {
        requestNumber,
        customerId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        address: input.address,
        preferredAt: input.preferredAt,
        priority,
        status: 'SUBMITTED',
        reviewDueAt,
      },
      include: {
        category: true,
        customer: true,
        attachments: {
          where: { deletedAt: null },
        },
        workOrder: true,
      },
    });
  });

  return formatServiceRequestDetail(request, 'CUSTOMER');
};

export const listServiceRequests = async (
  user: { id: string; role: Role },
  query: ListServiceRequestsQuery,
) => {
  const where: Prisma.ServiceRequestWhereInput = {
    deletedAt: null,
    ...(user.role === 'CUSTOMER' ? { customerId: user.id } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.findMany({
      where,
      include: {
        category: true,
        customer: true,
        _count: {
          select: {
            attachments: {
              where: { deletedAt: null },
            },
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
    items: items.map(formatServiceRequestListItem),
    total,
    page: query.page,
    limit: query.limit,
  };
};

export const searchServiceRequests = async (
  user: { id: string; role: Role },
  query: SearchServiceRequestsQuery,
) => {
  const where: Prisma.ServiceRequestWhereInput = {
    deletedAt: null,
    ...(user.role === 'CUSTOMER' ? { customerId: user.id } : {}),
    OR: [
      { requestNumber: { contains: query.q, mode: 'insensitive' } },
      { title: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ],
  };

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.serviceRequest.count({ where }),
    prisma.serviceRequest.findMany({
      where,
      include: {
        category: true,
        customer: true,
        _count: {
          select: {
            attachments: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map(formatServiceRequestListItem),
    total,
    page: query.page,
    limit: query.limit,
  };
};

export const getServiceRequestById = async (user: { id: string; role: Role }, id: string) => {
  const request = await prisma.serviceRequest.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: true,
      customer: true,
      attachments: {
        where: { deletedAt: null },
      },
      workOrder: true,
    },
  });

  if (!request) {
    throw new ApiError(404, 'Service request not found');
  }

  if (user.role === 'ADMIN') {
    // Admin can view any request
  } else if (user.role === 'CUSTOMER') {
    if (request.customerId !== user.id) {
      throw new ApiError(404, 'Service request not found');
    }
  } else if (user.role === 'TECHNICIAN') {
    if (!request.workOrder || request.workOrder.technicianId !== user.id) {
      throw new ApiError(404, 'Service request not found');
    }
  } else {
    throw new ApiError(404, 'Service request not found');
  }

  return formatServiceRequestDetail(request, user.role);
};

import type { Prisma, Role, WorkOrderStatus } from '@prisma/client';
import { isCloudinaryConfigured } from '../config/cloudinary';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type {
  AssignTechnicianInput,
  CancelWorkOrderInput,
  ListServiceHistoryQuery,
  ListWorkOrdersQuery,
  RejectWorkOrderInput,
  RescheduleWorkOrderInput,
  ScheduleWorkOrderInput,
  ServiceReportBodyInput,
  UpdateWorkOrderStatusInput,
} from '../validators/work-order.validator';
import {
  createLateFeeInvoice,
  type LateFeeInvoiceResult,
  shouldChargeLateFee,
} from './late-fee.service';
import { createNotification, notifyAdmins } from './notification.service';
import { getPremiumStatus } from './premium.service';
import { formatServiceRequestDetail } from './service-request.service';
import { deleteAsset, getSignedImageUrl, uploadPrivateImage } from './upload.service';
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

type ServiceReportWithTech = Prisma.ServiceReportGetPayload<{
  include: {
    technician: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

type WorkOrderDetailRow = Prisma.WorkOrderGetPayload<{
  include: {
    customer: true;
    technician: true;
    serviceReport: {
      include: {
        technician: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
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

export const formatServiceReport = (report: ServiceReportWithTech | null) => {
  if (!report) return null;
  const rawPhotos = Array.isArray(report.photos)
    ? (report.photos as { url: string; publicId: string; fileName: string }[])
    : [];

  return {
    id: report.id,
    workDone: report.workDone,
    partsUsed: report.partsUsed,
    hoursSpent: Number(report.hoursSpent),
    photos: rawPhotos.map((p) => ({
      url: getSignedImageUrl(p.publicId, p.url),
      fileName: p.fileName,
    })),
    technician: {
      id: report.technician.id,
      name: report.technician.name,
    },
    createdAt: report.createdAt,
  };
};

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
    serviceReport: formatServiceReport(wo.serviceReport),
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
        userId: technician.id,
        type: 'WORK_ORDER_ASSIGNED',
        title: 'New work order assigned',
        message: `You have been assigned to work order ${workOrder.serviceRequest.requestNumber}`,
        data: {
          workOrderId: workOrder.id,
          requestId: workOrder.serviceRequest.id,
        },
      },
      tx,
    );

    const updatedWorkOrder = await tx.workOrder.findUniqueOrThrow({
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

    return formatWorkOrderSummary(updatedWorkOrder);
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

    const now = new Date();
    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { acceptedAt: now },
    });

    await recordWorkOrderEvent(tx, {
      workOrderId,
      status: 'ASSIGNED',
      actor: technician,
      action: 'WORK_ORDER_ACCEPTED',
      note: 'Accepted by technician',
    });

    await notifyAdmins(
      {
        type: 'JOB_ACCEPTED',
        title: 'Work order accepted',
        message: `Technician accepted work order ${workOrder.serviceRequest.requestNumber}`,
        data: {
          workOrderId: workOrder.id,
          technicianId: technician.id,
        },
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
      actor: technician,
      data: {
        technicianId: null,
        acceptedAt: null,
      },
      note: input.reason,
    });

    await notifyAdmins(
      {
        type: 'JOB_REJECTED',
        title: 'Work order rejected',
        message: `Work order ${workOrder.serviceRequest.requestNumber} was rejected by technician. Reason: ${input.reason}`,
        data: {
          workOrderId: workOrder.id,
          technicianId: technician.id,
          reason: input.reason,
        },
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
      const initialWo = await tx.workOrder.findFirst({
        where: { id: workOrderId, deletedAt: null },
      });

      if (!initialWo) {
        throw new ApiError(404, 'Work order not found');
      }

      if (!initialWo.technicianId) {
        throw new ApiError(409, 'No technician is assigned yet');
      }

      const technicianId = initialWo.technicianId;

      await tx.$queryRaw`SELECT id FROM users WHERE id = ${technicianId} FOR UPDATE`;

      const workOrder = await tx.workOrder.findFirst({
        where: { id: workOrderId, deletedAt: null },
        include: {
          serviceRequest: true,
          technician: true,
        },
      });

      if (!workOrder) {
        throw new ApiError(404, 'Work order not found');
      }

      if (workOrder.status !== 'ASSIGNED' || workOrder.acceptedAt === null) {
        throw new ApiError(409, 'Work order must be ASSIGNED and accepted by the technician');
      }

      if (workOrder.technician?.status !== 'ACTIVE') {
        throw new ApiError(409, 'Technician is not active');
      }

      const conflict = await tx.workOrder.findFirst({
        where: {
          id: { not: workOrderId },
          technicianId,
          deletedAt: null,
          status: { in: ACTIVE_VISIT_STATUSES },
          visitStart: { lt: input.visitEnd },
          visitEnd: { gt: input.visitStart },
        },
      });

      if (conflict) {
        throw new ApiError(409, 'Technician already has a visit in this time window', [
          {
            field: 'visitStart',
            message: 'Time window conflicts with another visit',
          },
        ]);
      }

      const startIso = input.visitStart.toISOString();
      const endIso = input.visitEnd.toISOString();

      await transitionWorkOrder(tx, {
        workOrderId,
        to: 'SCHEDULED',
        actor: { id: admin.id, role: 'ADMIN', ip: admin.ip },
        data: {
          visitStart: input.visitStart,
          visitEnd: input.visitEnd,
        },
        note: `Scheduled for ${startIso} to ${endIso}`,
      });

      await createNotification(
        {
          userId: workOrder.customerId,
          type: 'VISIT_SCHEDULED',
          title: 'Visit scheduled',
          message: `Your service visit has been scheduled for ${startIso}`,
          data: {
            workOrderId: workOrder.id,
            visitStart: startIso,
            visitEnd: endIso,
          },
        },
        tx,
      );

      await createNotification(
        {
          userId: technicianId,
          type: 'VISIT_SCHEDULED',
          title: 'Visit scheduled',
          message: `Work order ${workOrder.serviceRequest.requestNumber} scheduled for ${startIso}`,
          data: {
            workOrderId: workOrder.id,
            visitStart: startIso,
            visitEnd: endIso,
          },
        },
        tx,
      );

      const updatedWo = await tx.workOrder.findUniqueOrThrow({
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

      return formatWorkOrderSummary(updatedWo);
    },
    {
      timeout: 20000,
      maxWait: 20000,
    },
  );
};

export const updateTechnicianStatus = async (
  technician: { id: string; role: Role; ip?: string },
  workOrderId: string,
  input: UpdateWorkOrderStatusInput,
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

    const now = new Date();
    let data: Prisma.WorkOrderUncheckedUpdateInput = {};

    if (input.status === 'ARRIVED') {
      data = { arrivedAt: now };
    } else if (input.status === 'IN_PROGRESS') {
      data = { startedAt: now };
    } else if (input.status === 'COMPLETED') {
      const report = await tx.serviceReport.findUnique({
        where: { workOrderId },
      });
      if (!report) {
        throw new ApiError(409, 'A service report is required before completing the job');
      }
      data = { completedAt: now };
    }

    await transitionWorkOrder(tx, {
      workOrderId,
      to: input.status,
      actor: technician,
      data,
    });

    if (input.status === 'ARRIVED') {
      await createNotification(
        {
          userId: workOrder.customerId,
          type: 'TECHNICIAN_ARRIVED',
          title: 'Technician arrived',
          message: `Technician has arrived for work order ${workOrder.serviceRequest.requestNumber}`,
          data: {
            workOrderId: workOrder.id,
          },
        },
        tx,
      );
    } else if (input.status === 'COMPLETED') {
      await createNotification(
        {
          userId: workOrder.customerId,
          type: 'WORK_COMPLETED',
          title: 'Work completed',
          message: `Work has been completed for work order ${workOrder.serviceRequest.requestNumber}`,
          data: {
            workOrderId: workOrder.id,
          },
        },
        tx,
      );

      await notifyAdmins(
        {
          type: 'WORK_COMPLETED',
          title: 'Work completed',
          message: `Technician completed work order ${workOrder.serviceRequest.requestNumber}`,
          data: {
            workOrderId: workOrder.id,
            technicianId: technician.id,
          },
        },
        tx,
      );
    }

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

export const createServiceReport = async (
  technician: { id: string; role: Role; ip?: string },
  workOrderId: string,
  input: ServiceReportBodyInput,
  files?: Express.Multer.File[],
) => {
  const initialWo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, deletedAt: null },
  });

  if (!initialWo || initialWo.technicianId !== technician.id) {
    throw new ApiError(404, 'Work order not found');
  }

  if (initialWo.status !== 'IN_PROGRESS') {
    throw new ApiError(409, 'Service report can only be written while the job is IN_PROGRESS');
  }

  const existing = await prisma.serviceReport.findUnique({
    where: { workOrderId },
  });

  if (existing) {
    throw new ApiError(409, 'A service report already exists for this job');
  }

  const hasPhotos = Boolean(files && files.length > 0);
  if (hasPhotos && !isCloudinaryConfigured()) {
    throw new ApiError(503, 'File upload is not configured');
  }

  const uploadedAssets: { url: string; publicId: string; fileName: string }[] = [];

  if (hasPhotos && files) {
    for (const file of files) {
      try {
        const uploadRes = await uploadPrivateImage(
          file.buffer,
          `field-service/service-reports/${workOrderId}`,
        );
        uploadedAssets.push({
          url: uploadRes.url,
          publicId: uploadRes.publicId,
          fileName: file.originalname,
        });
      } catch (_err) {
        for (const asset of uploadedAssets) {
          await deleteAsset(asset.publicId).catch(() => {});
        }
        throw new ApiError(502, 'File upload failed');
      }
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM work_orders WHERE id = ${workOrderId} FOR UPDATE`;

      const wo = await tx.workOrder.findFirst({
        where: { id: workOrderId, deletedAt: null },
      });

      if (!wo || wo.technicianId !== technician.id) {
        throw new ApiError(404, 'Work order not found');
      }

      if (wo.status !== 'IN_PROGRESS') {
        throw new ApiError(409, 'Service report can only be written while the job is IN_PROGRESS');
      }

      const reportExists = await tx.serviceReport.findUnique({
        where: { workOrderId },
      });

      if (reportExists) {
        throw new ApiError(409, 'A service report already exists for this job');
      }

      const report = await tx.serviceReport.create({
        data: {
          workOrderId,
          technicianId: technician.id,
          workDone: input.workDone,
          partsUsed: input.partsUsed as Prisma.InputJsonValue,
          hoursSpent: input.hoursSpent,
          photos: uploadedAssets.map((a) => ({
            url: a.url,
            publicId: a.publicId,
            fileName: a.fileName,
          })),
        },
        include: {
          technician: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return formatServiceReport(report);
    });
  } catch (err) {
    for (const asset of uploadedAssets) {
      await deleteAsset(asset.publicId).catch(() => {});
    }

    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new ApiError(409, 'A service report already exists for this job');
    }
    throw err;
  }
};

export const cancelWorkOrder = async (
  actor: { id: string; role: Role; ip?: string },
  workOrderId: string,
  input: CancelWorkOrderInput,
) => {
  return prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findFirst({
      where: { id: workOrderId, deletedAt: null },
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

    if (!workOrder) {
      throw new ApiError(404, 'Work order not found');
    }

    if (actor.role === 'CUSTOMER' && workOrder.customerId !== actor.id) {
      throw new ApiError(404, 'Work order not found');
    }

    const { isPremium } = await getPremiumStatus(workOrder.customerId);
    const charge = shouldChargeLateFee({
      actorRole: actor.role,
      status: workOrder.status,
      visitStart: workOrder.visitStart,
      isPremium,
    });

    await transitionWorkOrder(tx, {
      workOrderId,
      to: 'CANCELLED',
      actor,
      data: {
        cancelledAt: new Date(),
        cancelReason: input.reason,
      },
      note: input.reason,
    });

    let lateFee: LateFeeInvoiceResult | null = null;
    if (charge) {
      lateFee = await createLateFeeInvoice(tx, {
        workOrderId,
        customerId: workOrder.customerId,
        kind: 'CANCEL',
      });
    }

    if (actor.role === 'CUSTOMER') {
      await notifyAdmins(
        {
          type: 'WORK_ORDER_CANCELLED',
          title: 'Work order cancelled',
          message: `Customer cancelled work order ${workOrder.serviceRequest.requestNumber}. Reason: ${input.reason}`,
          data: {
            workOrderId: workOrder.id,
            reason: input.reason,
          },
        },
        tx,
      );

      if (workOrder.technicianId) {
        await createNotification(
          {
            userId: workOrder.technicianId,
            type: 'WORK_ORDER_CANCELLED',
            title: 'Work order cancelled',
            message: `Work order ${workOrder.serviceRequest.requestNumber} was cancelled by customer. Reason: ${input.reason}`,
            data: {
              workOrderId: workOrder.id,
              reason: input.reason,
            },
          },
          tx,
        );
      }
    } else if (actor.role === 'ADMIN') {
      await createNotification(
        {
          userId: workOrder.customerId,
          type: 'WORK_ORDER_CANCELLED',
          title: 'Work order cancelled',
          message: `Work order ${workOrder.serviceRequest.requestNumber} was cancelled by admin. Reason: ${input.reason}`,
          data: {
            workOrderId: workOrder.id,
            reason: input.reason,
          },
        },
        tx,
      );

      if (workOrder.technicianId) {
        await createNotification(
          {
            userId: workOrder.technicianId,
            type: 'WORK_ORDER_CANCELLED',
            title: 'Work order cancelled',
            message: `Work order ${workOrder.serviceRequest.requestNumber} was cancelled by admin. Reason: ${input.reason}`,
            data: {
              workOrderId: workOrder.id,
              reason: input.reason,
            },
          },
          tx,
        );
      }
    }

    const updatedWo = await tx.workOrder.findUniqueOrThrow({
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

    return {
      workOrder: formatWorkOrderSummary(updatedWo),
      lateFee,
    };
  });
};

export const rescheduleWorkOrder = async (
  actor: { id: string; role: Role; ip?: string },
  workOrderId: string,
  input: RescheduleWorkOrderInput,
) => {
  return prisma.$transaction(
    async (tx) => {
      const initialWo = await tx.workOrder.findFirst({
        where: { id: workOrderId, deletedAt: null },
      });

      if (!initialWo) {
        throw new ApiError(404, 'Work order not found');
      }

      if (actor.role === 'CUSTOMER' && initialWo.customerId !== actor.id) {
        throw new ApiError(404, 'Work order not found');
      }

      if (!initialWo.technicianId) {
        throw new ApiError(409, 'No technician is assigned yet');
      }

      const technicianId = initialWo.technicianId;

      await tx.$queryRaw`SELECT id FROM users WHERE id = ${technicianId} FOR UPDATE`;

      const workOrder = await tx.workOrder.findFirst({
        where: { id: workOrderId, deletedAt: null },
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

      if (!workOrder) {
        throw new ApiError(404, 'Work order not found');
      }

      if (actor.role === 'CUSTOMER' && workOrder.customerId !== actor.id) {
        throw new ApiError(404, 'Work order not found');
      }

      if (workOrder.status !== 'SCHEDULED') {
        throw new ApiError(409, 'Only SCHEDULED jobs can be rescheduled');
      }

      if (!workOrder.visitStart || !workOrder.visitEnd) {
        throw new ApiError(409, 'Work order does not have visit times set');
      }

      const conflict = await tx.workOrder.findFirst({
        where: {
          id: { not: workOrderId },
          technicianId,
          deletedAt: null,
          status: { in: ACTIVE_VISIT_STATUSES },
          visitStart: { lt: input.visitEnd },
          visitEnd: { gt: input.visitStart },
        },
      });

      if (conflict) {
        throw new ApiError(409, 'Technician already has a visit in this time window', [
          {
            field: 'visitStart',
            message: 'Time window conflicts with another visit',
          },
        ]);
      }

      const { isPremium } = await getPremiumStatus(workOrder.customerId);
      const charge = shouldChargeLateFee({
        actorRole: actor.role,
        status: workOrder.status,
        visitStart: workOrder.visitStart,
        isPremium,
      });

      const oldStart = workOrder.visitStart;
      const oldEnd = workOrder.visitEnd;

      const updated = await tx.workOrder.update({
        where: { id: workOrderId },
        data: {
          visitStart: input.visitStart,
          visitEnd: input.visitEnd,
        },
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

      await recordWorkOrderEvent(tx, {
        workOrderId,
        status: 'SCHEDULED',
        actor,
        action: 'WORK_ORDER_RESCHEDULED',
        note: `Rescheduled from ${oldStart.toISOString()} - ${oldEnd.toISOString()} to ${input.visitStart.toISOString()} - ${input.visitEnd.toISOString()}`,
        oldValues: {
          visitStart: oldStart.toISOString(),
          visitEnd: oldEnd.toISOString(),
        },
        newValues: {
          visitStart: input.visitStart.toISOString(),
          visitEnd: input.visitEnd.toISOString(),
        },
      });

      let lateFee: LateFeeInvoiceResult | null = null;
      if (charge) {
        lateFee = await createLateFeeInvoice(tx, {
          workOrderId,
          customerId: workOrder.customerId,
          kind: 'RESCHEDULE',
        });
      }

      if (actor.role === 'CUSTOMER') {
        await notifyAdmins(
          {
            type: 'WORK_ORDER_RESCHEDULED',
            title: 'Work order rescheduled',
            message: `Customer rescheduled work order ${workOrder.serviceRequest.requestNumber} to ${input.visitStart.toISOString()}`,
            data: {
              workOrderId: workOrder.id,
              visitStart: input.visitStart.toISOString(),
              visitEnd: input.visitEnd.toISOString(),
            },
          },
          tx,
        );

        if (technicianId) {
          await createNotification(
            {
              userId: technicianId,
              type: 'WORK_ORDER_RESCHEDULED',
              title: 'Work order rescheduled',
              message: `Work order ${workOrder.serviceRequest.requestNumber} has been rescheduled to ${input.visitStart.toISOString()}`,
              data: {
                workOrderId: workOrder.id,
                visitStart: input.visitStart.toISOString(),
                visitEnd: input.visitEnd.toISOString(),
              },
            },
            tx,
          );
        }
      } else if (actor.role === 'ADMIN') {
        await createNotification(
          {
            userId: workOrder.customerId,
            type: 'WORK_ORDER_RESCHEDULED',
            title: 'Work order rescheduled',
            message: `Your visit for work order ${workOrder.serviceRequest.requestNumber} has been rescheduled to ${input.visitStart.toISOString()}`,
            data: {
              workOrderId: workOrder.id,
              visitStart: input.visitStart.toISOString(),
              visitEnd: input.visitEnd.toISOString(),
            },
          },
          tx,
        );

        if (technicianId) {
          await createNotification(
            {
              userId: technicianId,
              type: 'WORK_ORDER_RESCHEDULED',
              title: 'Work order rescheduled',
              message: `Work order ${workOrder.serviceRequest.requestNumber} has been rescheduled to ${input.visitStart.toISOString()}`,
              data: {
                workOrderId: workOrder.id,
                visitStart: input.visitStart.toISOString(),
                visitEnd: input.visitEnd.toISOString(),
              },
            },
            tx,
          );
        }
      }

      return {
        workOrder: formatWorkOrderSummary(updated),
        lateFee,
      };
    },
    {
      timeout: 20000,
      maxWait: 20000,
    },
  );
};

export const listWorkOrders = async (
  user: { id: string; role: Role },
  query: ListWorkOrdersQuery,
) => {
  const where: Prisma.WorkOrderWhereInput = {
    deletedAt: null,
  };

  if (user.role === 'CUSTOMER') {
    where.customerId = user.id;
  } else if (user.role === 'TECHNICIAN') {
    where.technicianId = user.id;
  }

  if (query.status) {
    where.status = query.status;
  }

  const orderBy: Prisma.WorkOrderOrderByWithRelationInput = {};
  if (query.sortBy === 'visitStart') {
    orderBy.visitStart = query.order;
  } else if (query.sortBy === 'status') {
    orderBy.status = query.order;
  } else {
    orderBy.createdAt = query.order;
  }

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
      orderBy,
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
    status: {
      in: ['ASSIGNED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS'],
    },
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
      orderBy: [{ visitStart: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
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
      serviceReport: {
        include: {
          technician: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      serviceRequest: {
        include: {
          category: true,
          customer: true,
          attachments: true,
          workOrder: true,
        },
      },
    },
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

export const listServiceHistory = async (customerId: string, query: ListServiceHistoryQuery) => {
  const pastStatuses: WorkOrderStatus[] = ['COMPLETED', 'INVOICED', 'PAID', 'CLOSED', 'CANCELLED'];

  const where: Prisma.WorkOrderWhereInput = {
    customerId,
    deletedAt: null,
    status: query.status ? query.status : { in: pastStatuses },
  };

  if (query.categoryId) {
    where.serviceRequest = {
      categoryId: query.categoryId,
    };
  }

  let toDate: Date | undefined;
  if (query.dateTo) {
    if (query.dateTo.length === 10) {
      toDate = new Date(`${query.dateTo}T23:59:59.999Z`);
    } else {
      toDate = new Date(query.dateTo);
    }
  }
  const fromDate = query.dateFrom;

  const dateFilterConditions: Prisma.WorkOrderWhereInput[] = [];
  if (fromDate && toDate) {
    dateFilterConditions.push(
      { completedAt: { gte: fromDate, lte: toDate } },
      { cancelledAt: { gte: fromDate, lte: toDate } },
    );
  } else if (fromDate) {
    dateFilterConditions.push(
      { completedAt: { gte: fromDate } },
      { cancelledAt: { gte: fromDate } },
    );
  } else if (toDate) {
    dateFilterConditions.push({ completedAt: { lte: toDate } }, { cancelledAt: { lte: toDate } });
  }

  if (dateFilterConditions.length > 0) {
    where.AND = [{ OR: dateFilterConditions }];
  }

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      include: {
        customer: true,
        technician: true,
        serviceReport: true,
        serviceRequest: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: query.order,
      },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map((wo) => {
      const summary = formatWorkOrderSummary(wo);
      return {
        ...summary,
        completedAt: wo.completedAt,
        cancelledAt: wo.cancelledAt,
        cancelReason: wo.cancelReason,
        report: wo.serviceReport
          ? {
              workDone: wo.serviceReport.workDone,
              hoursSpent: Number(wo.serviceReport.hoursSpent),
            }
          : null,
      };
    }),
    total,
    page: query.page,
    limit: query.limit,
  };
};

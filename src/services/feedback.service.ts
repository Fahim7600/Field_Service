import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type { CreateFeedbackInput, ListFeedbackQuery } from '../validators/feedback.validator';
import { createNotification } from './notification.service';
import { transitionWorkOrder } from './work-order-state.service';

export const createFeedback = async (
  customerId: string,
  workOrderId: string,
  input: CreateFeedbackInput,
) => {
  return prisma.$transaction(async (tx) => {
    // 1. The work order must belong to the customer, deletedAt null
    const workOrder = await tx.workOrder.findFirst({
      where: { id: workOrderId, customerId, deletedAt: null },
      include: {
        invoices: {
          where: { type: 'MAIN', deletedAt: null },
        },
        feedback: true,
      },
    });

    if (!workOrder) {
      throw new ApiError(404, 'Work order not found');
    }

    // 2. technicianId must not be null
    if (!workOrder.technicianId) {
      throw new ApiError(409, 'Work order has no assigned technician');
    }

    // 3. The work order must have a MAIN invoice with status PAID
    const paidMainInvoice = workOrder.invoices.find(
      (inv) => inv.type === 'MAIN' && inv.status === 'PAID',
    );
    if (!paidMainInvoice) {
      throw new ApiError(409, 'Feedback is allowed only after the invoice is paid');
    }

    // 4. No feedback for this work order yet
    if (workOrder.feedback) {
      throw new ApiError(409, 'Feedback was already given for this job');
    }

    let feedback: {
      id: string;
      rating: number;
      comment: string | null;
      createdAt: Date;
    };
    try {
      feedback = await tx.feedback.create({
        data: {
          workOrderId,
          customerId,
          technicianId: workOrder.technicianId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
      });
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ApiError(409, 'Feedback was already given for this job');
      }
      throw err;
    }

    if (workOrder.status === 'PAID') {
      await transitionWorkOrder(tx, {
        workOrderId,
        to: 'CLOSED',
        actor: { id: customerId, role: 'SYSTEM' },
        note: 'Closed after customer feedback',
      });
    }

    await createNotification(
      {
        userId: workOrder.technicianId,
        type: 'FEEDBACK_RECEIVED',
        title: 'Feedback received',
        message: `Customer left a ${input.rating}-star feedback`,
        data: {
          workOrderId,
          feedbackId: feedback.id,
          rating: input.rating,
        },
      },
      tx,
    );

    return {
      feedback: {
        id: feedback.id,
        rating: feedback.rating,
        comment: feedback.comment,
        createdAt: feedback.createdAt,
      },
    };
  });
};

export const listFeedback = async (query: ListFeedbackQuery) => {
  const where: Prisma.FeedbackWhereInput = {};

  if (query.technicianId) {
    where.technicianId = query.technicianId;
  }
  if (query.rating) {
    where.rating = query.rating;
  }

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      include: {
        technician: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        workOrder: {
          select: {
            id: true,
            serviceRequest: { select: { requestNumber: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map((f) => ({
      id: f.id,
      rating: f.rating,
      comment: f.comment,
      createdAt: f.createdAt,
      technician: { id: f.technician.id, name: f.technician.name },
      customer: { id: f.customer.id, name: f.customer.name },
      workOrder: { id: f.workOrder.id },
      requestNumber: f.workOrder.serviceRequest.requestNumber,
    })),
    total,
    page: query.page,
    limit: query.limit,
  };
};

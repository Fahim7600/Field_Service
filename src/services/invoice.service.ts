import type { Prisma, Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { getStripe } from '../config/stripe';
import { ApiError } from '../utils/apiError';
import type {
  CreateInvoiceInput,
  ListInvoicesQuery,
  UpdateInvoiceInput,
  VoidInvoiceInput,
} from '../validators/invoice.validator';
import { writeAuditLog } from './audit.service';
import { assertPayableTotal, computeInvoiceTotals } from './invoice-calc.service';
import { generateInvoiceNumber } from './invoice-number.service';
import { createNotification } from './notification.service';
import { getPremiumStatus } from './premium.service';
import { transitionWorkOrder } from './work-order-state.service';

type InvoiceSummaryRow = Prisma.InvoiceGetPayload<{
  include: {
    workOrder: {
      select: {
        id: true;
        status: true;
      };
    };
    customer: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

type InvoiceDetailRow = Prisma.InvoiceGetPayload<{
  include: {
    items: {
      select: {
        id: true;
        type: true;
        description: true;
        quantity: true;
        unitAmountCents: true;
        amountCents: true;
      };
    };
    workOrder: {
      select: {
        id: true;
        status: true;
      };
    };
    customer: {
      select: {
        id: true;
        name: true;
      };
    };
    payments: {
      select: {
        id: true;
        status: true;
        amountCents: true;
        createdAt: true;
      };
    };
  };
}>;

export const formatInvoiceSummary = (inv: InvoiceSummaryRow) => {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    type: inv.type,
    status: inv.status,
    totalCents: inv.totalCents,
    currency: inv.currency,
    issuedAt: inv.issuedAt,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
    workOrder: {
      id: inv.workOrder.id,
      status: inv.workOrder.status,
    },
    customer: {
      id: inv.customer.id,
      name: inv.customer.name,
    },
  };
};

export const formatInvoiceDetail = (inv: InvoiceDetailRow) => {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    type: inv.type,
    status: inv.status,
    currency: inv.currency,
    laborCents: inv.laborCents,
    partsCents: inv.partsCents,
    extraCents: inv.extraCents,
    discountCents: inv.discountCents,
    taxCents: inv.taxCents,
    totalCents: inv.totalCents,
    notes: inv.notes,
    issuedAt: inv.issuedAt,
    paidAt: inv.paidAt,
    voidedAt: inv.voidedAt,
    voidReason: inv.voidReason,
    createdAt: inv.createdAt,
    items: inv.items.map((item) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
      amountCents: item.amountCents,
    })),
    workOrder: {
      id: inv.workOrder.id,
      status: inv.workOrder.status,
    },
    customer: {
      id: inv.customer.id,
      name: inv.customer.name,
    },
    payments: inv.payments.map((pm) => ({
      id: pm.id,
      status: pm.status,
      amountCents: pm.amountCents,
      createdAt: pm.createdAt,
    })),
  };
};

const invoiceDetailInclude = {
  items: {
    select: {
      id: true,
      type: true,
      description: true,
      quantity: true,
      unitAmountCents: true,
      amountCents: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  workOrder: {
    select: {
      id: true,
      status: true,
    },
  },
  customer: {
    select: {
      id: true,
      name: true,
    },
  },
  payments: {
    select: {
      id: true,
      status: true,
      amountCents: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
};

export const createInvoice = async (
  admin: { id: string; role: Role; ip?: string },
  input: CreateInvoiceInput,
) => {
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: input.workOrderId, deletedAt: null },
  });

  if (!workOrder) {
    throw new ApiError(404, 'Work order not found');
  }

  if (workOrder.status !== 'COMPLETED') {
    throw new ApiError(409, 'Invoices can only be created for COMPLETED work orders');
  }

  const { isPremium } = await getPremiumStatus(workOrder.customerId);
  const totals = computeInvoiceTotals({
    items: input.items,
    isPremium,
    taxPercent: env.TAX_PERCENT,
  });

  assertPayableTotal(totals.totalCents);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findFirst({
        where: {
          workOrderId: input.workOrderId,
          type: 'MAIN',
          status: { not: 'VOID' },
          deletedAt: null,
        },
      });

      if (existing) {
        throw new ApiError(409, 'This work order already has an invoice');
      }

      const invoiceNumber = await generateInvoiceNumber(tx);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          type: 'MAIN',
          status: 'DRAFT',
          currency: 'usd',
          workOrderId: input.workOrderId,
          customerId: workOrder.customerId,
          laborCents: totals.laborCents,
          partsCents: totals.partsCents,
          extraCents: totals.extraCents,
          discountCents: totals.discountCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          notes: input.notes ?? null,
          items: {
            create: totals.lines.map((line) => ({
              type: line.type,
              description: line.description,
              quantity: line.quantity,
              unitAmountCents: line.unitAmountCents,
              amountCents: line.amountCents,
            })),
          },
        },
        include: invoiceDetailInclude,
      });

      await writeAuditLog(tx, {
        actorId: admin.id,
        action: 'INVOICE_CREATED',
        entity: 'Invoice',
        entityId: invoice.id,
        newValues: {
          invoiceNumber,
          status: 'DRAFT',
          totalCents: totals.totalCents,
        },
        ipAddress: admin.ip,
      });

      return formatInvoiceDetail(invoice);
    });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new ApiError(409, 'This work order already has an invoice');
    }
    throw err;
  }
};

export const updateInvoice = async (
  admin: { id: string; role: Role; ip?: string },
  invoiceId: string,
  input: UpdateInvoiceInput,
) => {
  const initialInvoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    include: { items: true },
  });

  if (!initialInvoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  if (initialInvoice.status !== 'DRAFT') {
    throw new ApiError(409, 'Only DRAFT invoices can be edited');
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      include: { items: true },
    });

    if (!invoice) {
      throw new ApiError(404, 'Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new ApiError(409, 'Only DRAFT invoices can be edited');
    }

    let updateData: Prisma.InvoiceUpdateInput = {};

    if (input.items) {
      const isPremium = invoice.items.some((i) => i.type === 'DISCOUNT');
      const totals = computeInvoiceTotals({
        items: input.items,
        isPremium,
        taxPercent: env.TAX_PERCENT,
      });

      assertPayableTotal(totals.totalCents);

      await tx.invoiceItem.deleteMany({
        where: { invoiceId },
      });

      updateData = {
        laborCents: totals.laborCents,
        partsCents: totals.partsCents,
        extraCents: totals.extraCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        items: {
          create: totals.lines.map((line) => ({
            type: line.type,
            description: line.description,
            quantity: line.quantity,
            unitAmountCents: line.unitAmountCents,
            amountCents: line.amountCents,
          })),
        },
      };
    } else if (input.notes !== undefined) {
      updateData = {
        notes: input.notes,
      };
    }

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: invoiceDetailInclude,
    });

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: 'INVOICE_UPDATED',
      entity: 'Invoice',
      entityId: invoiceId,
      oldValues: {
        totalCents: invoice.totalCents,
        notes: invoice.notes,
      },
      newValues: {
        totalCents: updated.totalCents,
        notes: updated.notes,
      },
      ipAddress: admin.ip,
    });

    return formatInvoiceDetail(updated);
  });
};

export const sendInvoice = async (
  admin: { id: string; role: Role; ip?: string },
  invoiceId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      include: {
        workOrder: true,
      },
    });

    if (!invoice) {
      throw new ApiError(404, 'Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new ApiError(409, 'Invoice is already sent or processed');
    }

    assertPayableTotal(invoice.totalCents);

    const now = new Date();

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'ISSUED',
        issuedAt: now,
      },
      include: invoiceDetailInclude,
    });

    if (invoice.type === 'MAIN') {
      await transitionWorkOrder(tx, {
        workOrderId: invoice.workOrderId,
        to: 'INVOICED',
        actor: admin,
        note: 'Invoice issued',
      });
    }

    await createNotification(
      {
        userId: invoice.customerId,
        type: 'INVOICE_ISSUED',
        title: 'Invoice issued',
        message: `Invoice ${invoice.invoiceNumber} for $${(invoice.totalCents / 100).toFixed(2)} has been issued`,
        data: { invoiceId: invoice.id },
      },
      tx,
    );

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: 'INVOICE_SENT',
      entity: 'Invoice',
      entityId: invoice.id,
      oldValues: { status: 'DRAFT' },
      newValues: { status: 'ISSUED', issuedAt: now },
      ipAddress: admin.ip,
    });

    return formatInvoiceDetail(updated);
  });
};

export const voidInvoice = async (
  admin: { id: string; role: Role; ip?: string },
  invoiceId: string,
  input: VoidInvoiceInput,
) => {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      include: {
        workOrder: true,
      },
    });

    if (!invoice) {
      throw new ApiError(404, 'Invoice not found');
    }

    if (invoice.status === 'PAID' || invoice.status === 'VOID') {
      throw new ApiError(409, 'Only unpaid invoices can be voided');
    }

    const wasDraft = invoice.status === 'DRAFT';
    const now = new Date();

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'VOID',
        voidedAt: now,
        voidReason: input.reason,
      },
      include: invoiceDetailInclude,
    });

    const pendingPayments = await tx.payment.findMany({
      where: { invoiceId, status: 'PENDING' },
    });

    for (const payment of pendingPayments) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'CANCELLED' },
      });

      if (payment.stripeSessionId) {
        try {
          const stripe = getStripe();
          await stripe.checkout.sessions.expire(payment.stripeSessionId);
        } catch {
          // Ignore error
        }
      }
    }

    if (invoice.type === 'MAIN') {
      const wo = await tx.workOrder.findUnique({
        where: { id: invoice.workOrderId },
      });
      if (wo && wo.status === 'INVOICED') {
        await transitionWorkOrder(tx, {
          workOrderId: invoice.workOrderId,
          to: 'COMPLETED',
          actor: admin,
          note: `Invoice voided: ${input.reason}`,
        });
      }
    }

    if (!wasDraft) {
      await createNotification(
        {
          userId: invoice.customerId,
          type: 'INVOICE_VOIDED',
          title: 'Invoice voided',
          message: `Invoice ${invoice.invoiceNumber} has been voided. Reason: ${input.reason}`,
          data: { invoiceId: invoice.id, reason: input.reason },
        },
        tx,
      );
    }

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: 'INVOICE_VOIDED',
      entity: 'Invoice',
      entityId: invoice.id,
      oldValues: { status: invoice.status },
      newValues: { status: 'VOID', voidReason: input.reason },
      ipAddress: admin.ip,
    });

    return formatInvoiceDetail(updated);
  });
};

export const listInvoices = async (user: { id: string; role: Role }, query: ListInvoicesQuery) => {
  const where: Prisma.InvoiceWhereInput = {
    deletedAt: null,
  };

  if (user.role === 'CUSTOMER') {
    where.customerId = user.id;
    where.status = { not: 'DRAFT' };
    if (query.status && query.status !== 'DRAFT') {
      where.status = query.status;
    }
  } else {
    if (query.status) {
      where.status = query.status;
    }
  }

  const orderBy: Prisma.InvoiceOrderByWithRelationInput = {};
  if (query.sortBy === 'totalCents') {
    orderBy.totalCents = query.order;
  } else if (query.sortBy === 'status') {
    orderBy.status = query.order;
  } else {
    orderBy.createdAt = query.order;
  }

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: {
        workOrder: {
          select: {
            id: true,
            status: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy,
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map(formatInvoiceSummary),
    total,
    page: query.page,
    limit: query.limit,
  };
};

export const getInvoiceById = async (user: { id: string; role: Role }, id: string) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    include: invoiceDetailInclude,
  });

  if (!invoice) {
    throw new ApiError(404, 'Invoice not found');
  }

  if (user.role === 'ADMIN') {
    // Allowed
  } else if (user.role === 'CUSTOMER') {
    if (invoice.customerId !== user.id || invoice.status === 'DRAFT') {
      throw new ApiError(404, 'Invoice not found');
    }
  } else {
    throw new ApiError(404, 'Invoice not found');
  }

  return formatInvoiceDetail(invoice);
};

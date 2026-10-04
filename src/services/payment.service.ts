import { randomUUID } from 'node:crypto';
import type { Prisma, Role } from '@prisma/client';
import type Stripe from 'stripe';
import { CHECKOUT_SESSION_MINUTES } from '../config/business';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { getStripe } from '../config/stripe';
import { ApiError } from '../utils/apiError';
import type {
  InitiatePaymentInput,
  ListPaymentsQuery,
  RefundPaymentInput,
} from '../validators/payment.validator';
import { writeAuditLog } from './audit.service';
import { createNotification } from './notification.service';

const paymentDetailInclude = {
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      type: true,
      status: true,
    },
  },
};

type PaymentDetailRow = Prisma.PaymentGetPayload<{
  include: typeof paymentDetailInclude;
}>;

export const formatPaymentDetail = (payment: PaymentDetailRow) => ({
  id: payment.id,
  status: payment.status,
  amountCents: payment.amountCents,
  currency: payment.currency,
  failureReason: payment.failureReason,
  refundedAt: payment.refundedAt,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
  invoice: {
    id: payment.invoice.id,
    invoiceNumber: payment.invoice.invoiceNumber,
    type: payment.invoice.type,
    status: payment.invoice.status,
  },
});

export const formatPaymentSummary = (payment: PaymentDetailRow) => ({
  id: payment.id,
  status: payment.status,
  amountCents: payment.amountCents,
  currency: payment.currency,
  failureReason: payment.failureReason,
  refundedAt: payment.refundedAt,
  createdAt: payment.createdAt,
  invoice: {
    id: payment.invoice.id,
    invoiceNumber: payment.invoice.invoiceNumber,
    type: payment.invoice.type,
    status: payment.invoice.status,
  },
});

export const initiatePayment = async (customerId: string, input: InitiatePaymentInput) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, deletedAt: null },
  });

  if (!invoice || invoice.customerId !== customerId) {
    throw new ApiError(404, 'Invoice not found');
  }

  if (invoice.status !== 'ISSUED') {
    throw new ApiError(409, 'Invoice is not payable');
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoiceId} FOR UPDATE`;

      const freshInvoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, deletedAt: null },
        include: {
          customer: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!freshInvoice || freshInvoice.customerId !== customerId) {
        throw new ApiError(404, 'Invoice not found');
      }

      if (freshInvoice.status !== 'ISSUED') {
        throw new ApiError(409, 'Invoice is not payable');
      }

      const pendingPayment = await tx.payment.findFirst({
        where: {
          invoiceId: freshInvoice.id,
          status: 'PENDING',
        },
      });

      if (pendingPayment?.stripeSessionId) {
        try {
          const stripe = getStripe();
          const session = await stripe.checkout.sessions.retrieve(pendingPayment.stripeSessionId);

          if (session.status === 'open' && session.url) {
            return {
              paymentId: pendingPayment.id,
              paymentUrl: session.url,
            };
          }

          await tx.payment.update({
            where: { id: pendingPayment.id },
            data: { status: 'CANCELLED' },
          });
        } catch {
          await tx.payment.update({
            where: { id: pendingPayment.id },
            data: { status: 'CANCELLED' },
          });
        }
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId: freshInvoice.id,
          customerId: freshInvoice.customerId,
          amountCents: freshInvoice.totalCents,
          currency: 'usd',
          status: 'PENDING',
          idempotencyKey: randomUUID(),
        },
      });

      try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create(
          {
            mode: 'payment',
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: 'usd',
                  unit_amount: freshInvoice.totalCents,
                  product_data: {
                    name: `Invoice ${freshInvoice.invoiceNumber}`,
                  },
                },
              },
            ],
            customer_email: freshInvoice.customer.email,
            client_reference_id: payment.id,
            metadata: {
              paymentId: payment.id,
              invoiceId: freshInvoice.id,
            },
            success_url: `${env.PUBLIC_API_URL}/api/v1/payments/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${env.PUBLIC_API_URL}/api/v1/payments/cancel?session_id={CHECKOUT_SESSION_ID}`,
            expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_MINUTES * 60,
          },
          { idempotencyKey: payment.idempotencyKey },
        );

        if (!session.url) {
          throw new Error('No checkout session URL generated');
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            stripeSessionId: session.id,
          },
        });

        return {
          paymentId: payment.id,
          paymentUrl: session.url,
        };
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(502, 'Could not create the payment session');
      }
    },
    { timeout: 15000 },
  );
};

export const getPaymentStatusBySessionId = async (sessionId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { stripeSessionId: sessionId },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
        },
      },
    },
  });

  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  return {
    status: payment.status,
    invoiceNumber: payment.invoice.invoiceNumber,
    amountCents: payment.amountCents,
  };
};

export const getPaymentById = async (user: { id: string; role: Role }, id: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: paymentDetailInclude,
  });

  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  if (user.role === 'ADMIN') {
    // Allowed
  } else if (user.role === 'CUSTOMER') {
    if (payment.customerId !== user.id) {
      throw new ApiError(404, 'Payment not found');
    }
  } else {
    throw new ApiError(404, 'Payment not found');
  }

  return formatPaymentDetail(payment);
};

export const listPayments = async (user: { id: string; role: Role }, query: ListPaymentsQuery) => {
  const where: Prisma.PaymentWhereInput = {};

  if (user.role === 'CUSTOMER') {
    where.customerId = user.id;
  }

  if (query.status) {
    where.status = query.status;
  }

  const orderBy: Prisma.PaymentOrderByWithRelationInput = {};
  if (query.sortBy === 'amountCents') {
    orderBy.amountCents = query.order;
  } else if (query.sortBy === 'status') {
    orderBy.status = query.order;
  } else {
    orderBy.createdAt = query.order;
  }

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: paymentDetailInclude,
      orderBy,
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items: items.map(formatPaymentSummary),
    total,
    page: query.page,
    limit: query.limit,
  };
};

export const refundPayment = async (
  admin: { id: string; role: Role; ip?: string },
  paymentId: string,
  input: RefundPaymentInput,
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: true,
    },
  });

  if (!payment) {
    throw new ApiError(404, 'Payment not found');
  }

  if (payment.status !== 'SUCCEEDED') {
    throw new ApiError(409, 'Only successful payments can be refunded');
  }

  if (!payment.stripePaymentIntentId) {
    throw new ApiError(409, 'Payment does not have a Stripe payment intent');
  }

  let refund: Stripe.Refund;
  try {
    const stripe = getStripe();
    refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripePaymentIntentId,
        metadata: { paymentId: payment.id },
      },
      { idempotencyKey: `refund_${payment.id}` },
    );
  } catch {
    throw new ApiError(502, 'Stripe refund failed');
  }

  if (refund.status === 'succeeded') {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          refundedAt: now,
          stripeRefundId: refund.id,
        },
        include: paymentDetailInclude,
      });

      await createNotification(
        {
          userId: payment.customerId,
          type: 'PAYMENT_REFUNDED',
          title: 'Payment refunded',
          message: `Payment for invoice ${payment.invoice.invoiceNumber} has been refunded`,
          data: { paymentId: payment.id, invoiceId: payment.invoiceId },
        },
        tx,
      );

      await writeAuditLog(tx, {
        actorId: admin.id,
        action: 'PAYMENT_REFUNDED',
        entity: 'Payment',
        entityId: payment.id,
        newValues: {
          reason: input.reason,
          stripeRefundId: refund.id,
        },
        ipAddress: admin.ip,
      });

      return {
        statusCode: 200,
        message: 'Payment refunded',
        payment: formatPaymentDetail(updated),
      };
    });
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      stripeRefundId: refund.id,
    },
    include: paymentDetailInclude,
  });

  return {
    statusCode: 202,
    message: 'Refund submitted. The payment becomes REFUNDED when Stripe confirms',
    payment: formatPaymentDetail(updated),
  };
};

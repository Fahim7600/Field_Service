import type { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { prisma } from '../config/prisma';
import { writeAuditLog } from './audit.service';
import { createNotification, notifyAdmins } from './notification.service';
import { transitionWorkOrder } from './work-order-state.service';

export const webhookHandlers: Record<
  string,
  (tx: Prisma.TransactionClient, event: Stripe.Event) => Promise<void>
> = {
  'checkout.session.completed': async (tx, event) => {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== 'payment' || session.payment_status !== 'paid') {
      return;
    }

    const payment = await tx.payment.findUnique({
      where: { stripeSessionId: session.id },
      include: { invoice: true },
    });

    if (!payment) {
      console.warn(`Payment not found for stripeSessionId: ${session.id}`);
      return;
    }

    if (payment.status === 'SUCCEEDED') {
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCEEDED',
        stripePaymentIntentId: paymentIntentId,
      },
    });

    const invoice = await tx.invoice.findUnique({
      where: { id: payment.invoiceId },
    });

    if (!invoice) {
      return;
    }

    const now = new Date();
    if (invoice.status === 'ISSUED') {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      });

      if (invoice.type === 'MAIN') {
        await transitionWorkOrder(tx, {
          workOrderId: invoice.workOrderId,
          to: 'PAID',
          actor: { id: payment.customerId, role: 'SYSTEM' },
          note: 'Paid via Stripe',
        });
      }

      await createNotification(
        {
          userId: payment.customerId,
          type: 'PAYMENT_SUCCEEDED',
          title: 'Payment successful',
          message: `Payment for invoice ${invoice.invoiceNumber} was successful`,
          data: { paymentId: payment.id, invoiceId: invoice.id },
        },
        tx,
      );

      await writeAuditLog(tx, {
        actorId: null,
        action: 'PAYMENT_SUCCEEDED',
        entity: 'Payment',
        entityId: payment.id,
        newValues: {
          status: 'SUCCEEDED',
          stripePaymentIntentId: paymentIntentId,
        },
      });
    } else {
      await notifyAdmins(
        {
          type: 'PAYMENT_ANOMALY',
          title: 'Payment anomaly',
          message: `Payment received for non-issued invoice ${invoice.invoiceNumber} (status: ${invoice.status})`,
          data: { paymentId: payment.id, invoiceId: invoice.id },
        },
        tx,
      );

      await writeAuditLog(tx, {
        actorId: null,
        action: 'PAYMENT_ON_NON_ISSUED_INVOICE',
        entity: 'Payment',
        entityId: payment.id,
        newValues: {
          invoiceStatus: invoice.status,
          stripePaymentIntentId: paymentIntentId,
        },
      });
    }
  },

  'checkout.session.async_payment_failed': async (tx, event) => {
    const session = event.data.object as Stripe.Checkout.Session;
    const payment = await tx.payment.findUnique({
      where: { stripeSessionId: session.id },
      include: { invoice: true },
    });

    if (payment?.status !== 'PENDING') {
      return;
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason: 'Payment failed',
      },
    });

    await createNotification(
      {
        userId: payment.customerId,
        type: 'PAYMENT_FAILED',
        title: 'Payment failed',
        message: `Payment for invoice ${payment.invoice.invoiceNumber} failed`,
        data: { paymentId: payment.id, invoiceId: payment.invoiceId },
      },
      tx,
    );
  },

  'checkout.session.expired': async (tx, event) => {
    const session = event.data.object as Stripe.Checkout.Session;
    const payment = await tx.payment.findUnique({
      where: { stripeSessionId: session.id },
    });

    if (payment?.status !== 'PENDING') {
      return;
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CANCELLED',
      },
    });
  },

  'charge.refunded': async (tx, event) => {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : (charge.payment_intent?.id ?? null);

    if (!paymentIntentId) {
      return;
    }

    const payment = await tx.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { invoice: true },
    });

    if (payment?.status !== 'SUCCEEDED') {
      return;
    }

    const now = new Date();
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        refundedAt: now,
      },
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
      actorId: null,
      action: 'PAYMENT_REFUNDED',
      entity: 'Payment',
      entityId: payment.id,
      newValues: {
        status: 'REFUNDED',
        refundedAt: now,
      },
    });
  },
};

export const handleStripeEvent = async (
  event: Stripe.Event,
): Promise<{ received: boolean; duplicate?: boolean }> => {
  return prisma.$transaction(async (tx) => {
    try {
      await tx.stripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
        },
      });
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        return { received: true, duplicate: true };
      }
      throw err;
    }

    const handler = webhookHandlers[event.type];
    if (handler) {
      await handler(tx, event);
    }

    return { received: true };
  });
};

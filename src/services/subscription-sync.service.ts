import type { Prisma, Subscription, SubscriptionStatus } from '@prisma/client';
import type Stripe from 'stripe';
import { writeAuditLog } from './audit.service';
import { createNotification, notifyAdmins } from './notification.service';

export const syncSubscriptionFromStripe = async (
  tx: Prisma.TransactionClient,
  stripeSub: Stripe.Subscription,
  options?: { ended?: boolean },
): Promise<Subscription | null> => {
  const item = stripeSub.items?.data?.[0];
  const startUnix =
    item?.current_period_start ??
    (stripeSub as unknown as { current_period_start?: number }).current_period_start;
  const endUnix =
    item?.current_period_end ??
    (stripeSub as unknown as { current_period_end?: number }).current_period_end;

  const currentPeriodStart = startUnix ? new Date(startUnix * 1000) : null;
  const currentPeriodEnd = endUnix ? new Date(endUnix * 1000) : null;

  const customerId = stripeSub.metadata?.customerId;
  const planId = stripeSub.metadata?.planId;

  if (!customerId || !planId) {
    return null;
  }

  const customer = await tx.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER', deletedAt: null },
  });
  const plan = await tx.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!customer || !plan) {
    return null;
  }

  let mappedStatus: SubscriptionStatus | null = null;
  if (options?.ended) {
    const reason = stripeSub.cancellation_details?.reason;
    if (reason === 'payment_failed' || reason === 'payment_disputed') {
      mappedStatus = 'CANCELLED';
    } else {
      mappedStatus = 'EXPIRED';
    }
  } else {
    if (stripeSub.status === 'active' || stripeSub.status === 'trialing') {
      mappedStatus = 'ACTIVE';
    } else if (stripeSub.status === 'past_due' || stripeSub.status === 'unpaid') {
      mappedStatus = 'PAST_DUE';
    } else {
      mappedStatus = null;
    }
  }

  const cancelAtPeriodEnd = stripeSub.cancel_at_period_end === true || stripeSub.cancel_at != null;

  const stripeCustomerId =
    typeof stripeSub.customer === 'string' ? stripeSub.customer : (stripeSub.customer?.id ?? null);

  const existing = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSub.id },
  });

  if (!existing) {
    if (mappedStatus !== 'ACTIVE' && mappedStatus !== 'PAST_DUE') {
      return null;
    }

    if (mappedStatus === 'ACTIVE') {
      const activeExisting = await tx.subscription.findFirst({
        where: { customerId, status: 'ACTIVE' },
      });

      if (activeExisting) {
        await notifyAdmins(
          {
            type: 'SUBSCRIPTION_ANOMALY',
            title: 'Subscription anomaly',
            message: `Customer ${customerId} already has an active subscription. Duplicate Stripe subscription ${stripeSub.id} ignored.`,
            data: { customerId, stripeSubscriptionId: stripeSub.id },
          },
          tx,
        );

        await writeAuditLog(tx, {
          actorId: null,
          action: 'SUBSCRIPTION_DUPLICATE_IGNORED',
          entity: 'Subscription',
          entityId: stripeSub.id,
          newValues: { customerId, stripeSubscriptionId: stripeSub.id },
        });

        return null;
      }
    }

    const created = await tx.subscription.create({
      data: {
        customerId,
        planId,
        status: mappedStatus,
        stripeCustomerId: stripeCustomerId ?? undefined,
        stripeSubscriptionId: stripeSub.id,
        currentPeriodStart: currentPeriodStart ?? undefined,
        currentPeriodEnd: currentPeriodEnd ?? undefined,
        cancelAtPeriodEnd,
      },
    });

    if (mappedStatus === 'ACTIVE') {
      await createNotification(
        {
          userId: customerId,
          type: 'PREMIUM_ACTIVATED',
          title: 'Premium activated',
          message: 'Your premium subscription has been activated',
          data: { subscriptionId: created.id },
        },
        tx,
      );

      await writeAuditLog(tx, {
        actorId: null,
        action: 'SUBSCRIPTION_STATUS_CHANGED',
        entity: 'Subscription',
        entityId: created.id,
        oldValues: undefined,
        newValues: { status: mappedStatus },
      });
    }

    return created;
  }

  if (existing.status === 'EXPIRED' || existing.status === 'CANCELLED') {
    return existing;
  }

  const targetStatus = mappedStatus ?? existing.status;

  const updated = await tx.subscription.update({
    where: { id: existing.id },
    data: {
      status: targetStatus,
      currentPeriodStart: currentPeriodStart ?? existing.currentPeriodStart,
      currentPeriodEnd: currentPeriodEnd ?? existing.currentPeriodEnd,
      cancelAtPeriodEnd,
      stripeCustomerId: stripeCustomerId ?? existing.stripeCustomerId,
    },
  });

  if (existing.status !== targetStatus) {
    await writeAuditLog(tx, {
      actorId: null,
      action: 'SUBSCRIPTION_STATUS_CHANGED',
      entity: 'Subscription',
      entityId: updated.id,
      oldValues: { status: existing.status },
      newValues: { status: targetStatus },
    });

    if (targetStatus === 'PAST_DUE') {
      await createNotification(
        {
          userId: customerId,
          type: 'PREMIUM_PAYMENT_FAILED',
          title: 'Premium payment failed',
          message:
            'Payment for your premium subscription failed. Please update your payment method.',
          data: { subscriptionId: updated.id },
        },
        tx,
      );
    } else if (targetStatus === 'ACTIVE') {
      await createNotification(
        {
          userId: customerId,
          type: 'PREMIUM_RESTORED',
          title: 'Premium restored',
          message: 'Your premium subscription has been restored.',
          data: { subscriptionId: updated.id },
        },
        tx,
      );
    } else if (targetStatus === 'EXPIRED') {
      await createNotification(
        {
          userId: customerId,
          type: 'PREMIUM_EXPIRED',
          title: 'Premium expired',
          message: 'Your premium subscription has expired.',
          data: { subscriptionId: updated.id },
        },
        tx,
      );
    } else if (targetStatus === 'CANCELLED') {
      await createNotification(
        {
          userId: customerId,
          type: 'PREMIUM_EXPIRED',
          title: 'Premium expired',
          message: 'Your premium subscription has been cancelled.',
          data: { subscriptionId: updated.id },
        },
        tx,
      );
    }
  }

  if (!existing.cancelAtPeriodEnd && cancelAtPeriodEnd) {
    const endStr = currentPeriodEnd
      ? currentPeriodEnd.toLocaleDateString()
      : 'the end of the billing period';
    await createNotification(
      {
        userId: customerId,
        type: 'PREMIUM_CANCEL_SCHEDULED',
        title: 'Premium cancellation scheduled',
        message: `Your premium subscription is scheduled to cancel on ${endStr}`,
        data: { subscriptionId: updated.id, currentPeriodEnd },
      },
      tx,
    );
  }

  return updated;
};

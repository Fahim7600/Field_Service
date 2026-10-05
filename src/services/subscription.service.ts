import type { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { PREMIUM_BENEFITS } from '../config/business';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { getStripe } from '../config/stripe';
import { ApiError } from '../utils/apiError';
import type {
  CheckoutSubscriptionInput,
  ListSubscriptionsQuery,
} from '../validators/subscription.validator';
import { getPremiumStatus, invalidatePremiumCache } from './premium.service';
import { syncSubscriptionFromStripe } from './subscription-sync.service';

export const listPlans = async () => {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { priceCents: 'asc' },
  });

  return {
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      interval: plan.interval,
      priceCents: plan.priceCents,
      currency: plan.currency,
      benefits: PREMIUM_BENEFITS,
    })),
  };
};

export const createCheckoutSession = async (
  customerId: string,
  input: CheckoutSubscriptionInput,
) => {
  const [user, plan] = await Promise.all([
    prisma.user.findFirst({
      where: { id: customerId, role: 'CUSTOMER', deletedAt: null },
      select: { id: true, email: true },
    }),
    prisma.subscriptionPlan.findFirst({
      where: { id: input.planId, isActive: true },
    }),
  ]);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!plan) {
    throw new ApiError(404, 'Plan not found');
  }

  if (!plan.stripePriceId) {
    throw new ApiError(503, 'Premium plans are not configured');
  }

  const existingSub = await prisma.subscription.findFirst({
    where: {
      customerId: user.id,
      status: { in: ['ACTIVE', 'PAST_DUE'] },
    },
  });

  if (existingSub) {
    throw new ApiError(409, 'You already have a premium subscription');
  }

  let price: Stripe.Price;
  try {
    const stripe = getStripe();
    price = await stripe.prices.retrieve(plan.stripePriceId);
  } catch {
    throw new ApiError(502, 'Could not create the checkout session');
  }

  const expectedInterval = plan.interval === 'MONTH' ? 'month' : 'year';
  if (
    !price.active ||
    price.currency.toLowerCase() !== plan.currency.toLowerCase() ||
    price.unit_amount !== plan.priceCents ||
    price.recurring?.interval !== expectedInterval
  ) {
    throw new ApiError(503, 'Premium plan is not configured correctly');
  }

  const prevSub = await prisma.subscription.findFirst({
    where: {
      customerId: user.id,
      stripeCustomerId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  try {
    const stripe = getStripe();
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: {
        customerId: user.id,
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          customerId: user.id,
          planId: plan.id,
        },
      },
      success_url: `${env.PUBLIC_API_URL}/api/v1/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.PUBLIC_API_URL}/api/v1/subscriptions/cancel?session_id={CHECKOUT_SESSION_ID}`,
    };

    if (prevSub?.stripeCustomerId) {
      sessionParams.customer = prevSub.stripeCustomerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) {
      throw new ApiError(502, 'Could not create the checkout session');
    }

    return { checkoutUrl: session.url };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, 'Could not create the checkout session');
  }
};

export const getMySubscription = async (customerId: string) => {
  const [premiumStatus, sub] = await Promise.all([
    getPremiumStatus(customerId),
    prisma.subscription.findFirst({
      where: { customerId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const subscription = sub
    ? {
        id: sub.id,
        status: sub.status,
        plan: {
          id: sub.plan.id,
          name: sub.plan.name,
          interval: sub.plan.interval,
          priceCents: sub.plan.priceCents,
          currency: sub.plan.currency,
        },
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        nextRenewalAt:
          sub.status === 'ACTIVE' && !sub.cancelAtPeriodEnd ? sub.currentPeriodEnd : null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        createdAt: sub.createdAt,
      }
    : null;

  return {
    isPremium: premiumStatus.isPremium,
    subscription,
    benefits: PREMIUM_BENEFITS,
  };
};

export const cancelSubscription = async (customerId: string) => {
  const sub = await prisma.subscription.findFirst({
    where: {
      customerId,
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      stripeSubscriptionId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });

  if (!sub?.stripeSubscriptionId) {
    throw new ApiError(409, 'You do not have a subscription to cancel');
  }

  if (sub.cancelAtPeriodEnd) {
    throw new ApiError(409, 'Cancellation is already scheduled');
  }

  let stripeSub: Stripe.Subscription;
  try {
    const stripe = getStripe();
    stripeSub = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } catch {
    throw new ApiError(502, 'Could not cancel the subscription');
  }

  const updatedSub = await prisma.$transaction(async (tx) => {
    const synced = await syncSubscriptionFromStripe(tx, stripeSub);
    if (!synced) {
      return tx.subscription.update({
        where: { id: sub.id },
        data: { cancelAtPeriodEnd: true },
        include: { plan: true },
      });
    }
    return tx.subscription.findUniqueOrThrow({
      where: { id: synced.id },
      include: { plan: true },
    });
  });

  await invalidatePremiumCache(customerId);

  return {
    subscription: {
      id: updatedSub.id,
      status: updatedSub.status,
      plan: {
        id: updatedSub.plan.id,
        name: updatedSub.plan.name,
        interval: updatedSub.plan.interval,
        priceCents: updatedSub.plan.priceCents,
        currency: updatedSub.plan.currency,
      },
      currentPeriodStart: updatedSub.currentPeriodStart,
      currentPeriodEnd: updatedSub.currentPeriodEnd,
      nextRenewalAt:
        updatedSub.status === 'ACTIVE' && !updatedSub.cancelAtPeriodEnd
          ? updatedSub.currentPeriodEnd
          : null,
      cancelAtPeriodEnd: updatedSub.cancelAtPeriodEnd,
      createdAt: updatedSub.createdAt,
    },
  };
};

export const listAdminSubscriptions = async (query: ListSubscriptionsQuery) => {
  const where: Prisma.SubscriptionWhereInput = {};
  if (query.status) {
    where.status = query.status;
  }

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            interval: true,
            priceCents: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
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
    items: items.map((item) => ({
      id: item.id,
      status: item.status,
      plan: {
        id: item.plan.id,
        name: item.plan.name,
        interval: item.plan.interval,
        priceCents: item.plan.priceCents,
      },
      customer: {
        id: item.customer.id,
        name: item.customer.name,
        email: item.customer.email,
      },
      currentPeriodStart: item.currentPeriodStart,
      currentPeriodEnd: item.currentPeriodEnd,
      cancelAtPeriodEnd: item.cancelAtPeriodEnd,
      createdAt: item.createdAt,
    })),
    total,
    page: query.page,
    limit: query.limit,
  };
};

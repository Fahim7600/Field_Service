import { prisma } from '../config/prisma';

export interface PremiumStatus {
  isPremium: boolean;
  planName: string | null;
  interval: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export const getPremiumStatus = async (customerId: string): Promise<PremiumStatus> => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      customerId,
      status: 'ACTIVE',
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!subscription) {
    return {
      isPremium: false,
      planName: null,
      interval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  return {
    isPremium: true,
    planName: subscription.plan.name,
    interval: subscription.plan.interval,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
};

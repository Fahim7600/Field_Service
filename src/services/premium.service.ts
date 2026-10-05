import { prisma } from '../config/prisma';
import { deleteCache, getCache, setCache } from '../lib/redis';

export interface PremiumStatus {
  isPremium: boolean;
  planName: string | null;
  interval: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

const PREMIUM_CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

export const getPremiumCacheKey = (customerId: string): string => {
  return `premium:${customerId}`;
};

export const invalidatePremiumCache = async (customerId: string): Promise<void> => {
  await deleteCache(getPremiumCacheKey(customerId));
};

export const getPremiumStatus = async (customerId: string): Promise<PremiumStatus> => {
  const cacheKey = getPremiumCacheKey(customerId);

  // Try reading from cache
  const cached = await getCache(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as {
        isPremium: boolean;
        planName: string | null;
        interval: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
      };
      return {
        isPremium: parsed.isPremium,
        planName: parsed.planName,
        interval: parsed.interval,
        currentPeriodEnd: parsed.currentPeriodEnd ? new Date(parsed.currentPeriodEnd) : null,
        cancelAtPeriodEnd: parsed.cancelAtPeriodEnd,
      };
    } catch {
      // Ignore cache parse error, fallback to db
    }
  }

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
    const result: PremiumStatus = {
      isPremium: false,
      planName: null,
      interval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
    await setCache(cacheKey, JSON.stringify(result), PREMIUM_CACHE_TTL_SECONDS);
    return result;
  }

  const result: PremiumStatus = {
    isPremium: true,
    planName: subscription.plan.name,
    interval: subscription.plan.interval,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };

  await setCache(cacheKey, JSON.stringify(result), PREMIUM_CACHE_TTL_SECONDS);
  return result;
};

import { prisma } from '../src/config/prisma';
import { closeRedis, getCache, isRedisReady, redis } from '../src/lib/redis';
import { getPremiumStatus, invalidatePremiumCache } from '../src/services/premium.service';
import { hashPassword } from '../src/utils/password';

async function main() {
  console.log('--- Starting Redis Premium Cache Tests ---');

  const passwordHash = await hashPassword('Password123!');
  const testEmail = `cache_test_user_${Date.now()}@test.com`;

  // Create test customer
  const user = await prisma.user.create({
    data: {
      name: 'Cache Test User',
      email: testEmail,
      passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customerProfile: { create: {} },
    },
  });

  // Create active subscription plan
  let plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true } });
  if (!plan) {
    plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Cache Test Plan',
        interval: 'MONTH',
        priceCents: 1999,
        stripePriceId: 'price_cache_test',
        isActive: true,
      },
    });
  }

  const cacheKey = `premium:${user.id}`;

  try {
    // 1. Initial status: non-premium
    await invalidatePremiumCache(user.id);
    const initialStatus = await getPremiumStatus(user.id);
    console.assert(initialStatus.isPremium === false, 'Expected isPremium false initially');

    if (redis && isRedisReady()) {
      const cachedInitial = await getCache(cacheKey);
      console.assert(Boolean(cachedInitial), 'Expected non-premium status to be cached in Redis');
      console.log('PASS: Initial non-premium status cached');
    }

    // 2. Create active subscription
    await prisma.subscription.create({
      data: {
        customerId: user.id,
        planId: plan.id,
        status: 'ACTIVE',
        stripeSubscriptionId: `sub_cache_test_${Date.now()}`,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
    });

    // Invalidate and re-query
    await invalidatePremiumCache(user.id);
    const activeStatus = await getPremiumStatus(user.id);
    console.assert(activeStatus.isPremium === true, 'Expected isPremium true after subscription');
    console.assert(activeStatus.planName === plan.name, 'Expected planName to match');

    if (redis && isRedisReady()) {
      const cachedActive = await getCache(cacheKey);
      console.assert(Boolean(cachedActive), 'Expected active premium status to be cached in Redis');
      if (cachedActive) {
        const parsed = JSON.parse(cachedActive);
        console.assert(parsed.isPremium === true, 'Cached status isPremium should be true');
      }
      console.log('PASS: Premium status cached with 5m TTL');
    }

    // 3. Invalidate cache upon cancel / change
    await invalidatePremiumCache(user.id);
    if (redis && isRedisReady()) {
      const cachedAfterInvalidate = await getCache(cacheKey);
      console.assert(
        cachedAfterInvalidate === null,
        'Cache key should be deleted after invalidation',
      );
      console.log('PASS: Cache key cleared after invalidation');
    }

    // 4. Test fail-open: Works when Redis key is absent / Redis bypass
    const freshStatus = await getPremiumStatus(user.id);
    console.assert(
      freshStatus.isPremium === true,
      'Expected isPremium true on cache miss DB fallback',
    );
    console.log('PASS: DB fallback works seamlessly');

    // Clean up test data
    await prisma.subscription.deleteMany({ where: { customerId: user.id } });
    await prisma.customerProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await invalidatePremiumCache(user.id);

    console.log('ALL REDIS PREMIUM CACHE TESTS PASSED!\n');
    await closeRedis();
    process.exit(0);
  } catch (err) {
    // Clean up test data on error
    await prisma.subscription.deleteMany({ where: { customerId: user.id } }).catch(() => {});
    await prisma.customerProfile.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    await invalidatePremiumCache(user.id).catch(() => {});
    await closeRedis();
    console.error('FAIL: Redis Premium Cache test error:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

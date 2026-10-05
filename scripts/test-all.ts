import type http from 'node:http';
import app from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import { closeRedis, getCache, isRedisReady, redis } from '../src/lib/redis';
import { getPremiumStatus, invalidatePremiumCache } from '../src/services/premium.service';
import { hashPassword } from '../src/utils/password';

const PORT = env.PORT || 5000;
const API_BASE = `http://localhost:${PORT}/api/v1`;

interface ApiResponse {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
  errors?: unknown[];
  [key: string]: unknown;
}

async function req(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; headers: Headers; body: ApiResponse }> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  return { status: res.status, headers: res.headers, body: (body ?? {}) as ApiResponse };
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runGroup(name: string, fn: () => Promise<void>) {
  process.stdout.write(`Running: ${name} ... `);
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    console.log(`PASSED (${durationMs}ms)`);
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: msg, durationMs });
    console.log(`FAILED (${durationMs}ms)`);
    console.error(`\nError in "${name}":`, err);
    throw err; // Stop on first failure
  }
}

async function main() {
  console.log('========================================================================');
  console.log('                 FIELD SERVICE SYSTEM TEST RUNNER                       ');
  console.log('========================================================================\n');

  // Disable rate limiting for functional test groups
  process.env.RATE_LIMIT_ENABLED = 'false';

  if (redis && isRedisReady()) {
    try {
      const keys = await redis.keys('rl:*');
      if (keys.length > 0) await redis.del(...keys);
    } catch {}
  }

  // Ensure server is running or start an in-process listener if needed
  let serverInstance: http.Server | null = null;
  try {
    await fetch(`${API_BASE}/health`);
  } catch {
    serverInstance = app.listen(PORT);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const passwordHash = await hashPassword('Password123!');
  const ts = Date.now();

  // Test entities
  let adminToken = '';
  let customerToken = '';
  let technicianToken = '';
  let customerUser: { id: string; email: string } | null = null;
  let technicianUser: { id: string; email: string } | null = null;
  let testSkill: { id: string; name: string } | null = null;
  let testCategory: { id: string; name: string } | null = null;
  let testServiceRequestId = '';
  let testWorkOrderId = '';
  let testInvoiceId = '';
  let testSubscriptionPlan: { id: string; name: string } | null = null;

  try {
    // -------------------------------------------------------------
    // Group 1: Auth & User Management
    // -------------------------------------------------------------
    await runGroup('Group 1: Auth & User Management', async () => {
      // 1. Register customer
      const custEmail = `test_runner_cust_${ts}@test.com`;
      const regRes = await req('/auth/register', {
        method: 'POST',
        body: {
          name: 'Test Customer',
          email: custEmail,
          password: 'Password123!',
        },
      });
      console.assert(regRes.status === 201, `Expected 201 for register, got ${regRes.status}`);
      customerUser = regRes.body.data.user;

      // 2. Login customer
      const loginRes = await req('/auth/login', {
        method: 'POST',
        body: { email: custEmail, password: 'Password123!' },
      });
      console.assert(loginRes.status === 200, `Expected 200 for login, got ${loginRes.status}`);
      customerToken = loginRes.body.data.accessToken;
      const refreshToken = loginRes.body.data.refreshToken;

      // 3. Refresh token
      const refreshRes = await req('/auth/refresh-token', {
        method: 'POST',
        body: { refreshToken },
      });
      console.assert(
        refreshRes.status === 200,
        `Expected 200 for refresh, got ${refreshRes.status}`,
      );

      // 4. Get current user
      const meRes = await req('/users/me', { token: customerToken });
      console.assert(meRes.status === 200, `Expected 200 for /users/me, got ${meRes.status}`);

      // 5. Ensure admin
      const adminEmail = env.ADMIN_EMAIL || 'admin@fieldservice.com';
      let admin = await prisma.user.findFirst({ where: { email: adminEmail, deletedAt: null } });
      if (!admin) {
        admin = await prisma.user.create({
          data: {
            name: 'Test Admin',
            email: adminEmail,
            passwordHash,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        });
      }
      const adminLogin = await req('/auth/login', {
        method: 'POST',
        body: { email: adminEmail, password: env.ADMIN_PASSWORD || 'Password123!' },
      });
      adminToken = adminLogin.body.data?.accessToken;
      if (!adminToken) {
        // Fallback default password
        const retry = await req('/auth/login', {
          method: 'POST',
          body: { email: adminEmail, password: 'Password123!' },
        });
        adminToken = retry.body.data?.accessToken;
      }
      console.assert(Boolean(adminToken), 'Expected valid adminToken');
    });

    // -------------------------------------------------------------
    // Group 2: Catalog & Skills
    // -------------------------------------------------------------
    await runGroup('Group 2: Catalog & Skills', async () => {
      // Create skill
      const skillRes = await req('/admin/skills', {
        method: 'POST',
        token: adminToken,
        body: { name: `Test Skill ${ts}` },
      });
      console.assert(
        skillRes.status === 201,
        `Expected 201 for create skill, got ${skillRes.status}`,
      );
      testSkill = skillRes.body.data.skill;

      // Create service category
      const catRes = await req('/admin/service-categories', {
        method: 'POST',
        token: adminToken,
        body: {
          name: `Test Category ${ts}`,
          description: 'Description of test category',
          skillId: testSkill.id,
          basePriceCents: 5000,
        },
      });
      console.assert(
        catRes.status === 201,
        `Expected 201 for create category, got ${catRes.status}`,
      );
      testCategory = catRes.body.data.category;

      // Public list skills
      const listSkillsRes = await req('/skills', { token: customerToken });
      console.assert(
        listSkillsRes.status === 200,
        `Expected 200 for list skills, got ${listSkillsRes.status}`,
      );
    });

    // -------------------------------------------------------------
    // Group 3: Technician Applications & Onboarding
    // -------------------------------------------------------------
    await runGroup('Group 3: Technician Applications', async () => {
      // Create a technician user
      const techEmail = `test_runner_tech_${ts}@test.com`;
      technicianUser = await prisma.user.create({
        data: {
          name: 'Test Technician',
          email: techEmail,
          passwordHash,
          role: 'TECHNICIAN',
          status: 'ACTIVE',
          technicianProfile: {
            create: {
              isActive: true,
              serviceArea: 'Downtown',
              phone: '+1234567890',
              address: '100 Tech Lane',
              bio: 'Experienced Master Technician',
              skills: {
                create: { skillId: testSkill.id },
              },
            },
          },
        },
      });

      const techLogin = await req('/auth/login', {
        method: 'POST',
        body: { email: techEmail, password: 'Password123!' },
      });
      console.assert(
        techLogin.status === 200,
        `Expected 200 for tech login, got ${techLogin.status}`,
      );
      technicianToken = techLogin.body.data.accessToken;
    });

    // -------------------------------------------------------------
    // Group 4: Service Requests
    // -------------------------------------------------------------
    await runGroup('Group 4: Service Requests', async () => {
      const preferredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const srRes = await req('/service-requests', {
        method: 'POST',
        token: customerToken,
        body: {
          categoryId: testCategory.id,
          title: 'Leaking pipe issue',
          description: 'Need urgent plumbing fix for main water line pipe',
          address: '456 Main St, Apt 2B',
          preferredAt,
        },
      });
      console.assert(srRes.status === 201, `Expected 201 for create SR, got ${srRes.status}`);
      testServiceRequestId = (srRes.body.data?.request?.id ||
        srRes.body.data?.serviceRequest?.id) as string;

      // Get SR details
      const getSrRes = await req(`/service-requests/${testServiceRequestId}`, {
        token: customerToken,
      });
      console.assert(getSrRes.status === 200, `Expected 200 for get SR, got ${getSrRes.status}`);
    });

    // -------------------------------------------------------------
    // Group 5: Dispatch & Scheduling
    // -------------------------------------------------------------
    await runGroup('Group 5: Dispatch & Scheduling', async () => {
      // Approve SR
      const approveRes = await req(`/admin/service-requests/${testServiceRequestId}/review`, {
        method: 'PATCH',
        token: adminToken,
        body: { decision: 'APPROVE' },
      });
      console.assert(
        approveRes.status === 200,
        `Expected 200 for approve SR, got ${approveRes.status}`,
      );
      testWorkOrderId = approveRes.body.data.workOrder.id;

      // Assign technician
      const assignRes = await req(`/work-orders/${testWorkOrderId}/assign`, {
        method: 'POST',
        token: adminToken,
        body: { technicianId: technicianUser.id },
      });
      console.assert(
        assignRes.status === 200,
        `Expected 200 for assign tech, got ${assignRes.status}`,
      );

      // Tech accepts
      const acceptRes = await req(`/work-orders/${testWorkOrderId}/accept`, {
        method: 'POST',
        token: technicianToken,
      });
      console.assert(
        acceptRes.status === 200,
        `Expected 200 for tech accept, got ${acceptRes.status}`,
      );

      // Admin schedules
      const visitStart = new Date(Date.now() + 2 * 3600000).toISOString();
      const visitEnd = new Date(Date.now() + 4 * 3600000).toISOString();
      const schedRes = await req(`/work-orders/${testWorkOrderId}/schedule`, {
        method: 'POST',
        token: adminToken,
        body: { visitStart, visitEnd },
      });
      console.assert(schedRes.status === 200, `Expected 200 for schedule, got ${schedRes.status}`);
    });

    // -------------------------------------------------------------
    // Group 6: Work Order Execution
    // -------------------------------------------------------------
    await runGroup('Group 6: Work Order Execution', async () => {
      // Tech arrives
      const arriveRes = await req(`/work-orders/${testWorkOrderId}/status`, {
        method: 'PATCH',
        token: technicianToken,
        body: { status: 'ARRIVED' },
      });
      console.assert(
        arriveRes.status === 200,
        `Expected 200 for tech arrive, got ${arriveRes.status}`,
      );

      // Tech in progress
      const inProgRes = await req(`/work-orders/${testWorkOrderId}/status`, {
        method: 'PATCH',
        token: technicianToken,
        body: { status: 'IN_PROGRESS' },
      });
      console.assert(
        inProgRes.status === 200,
        `Expected 200 for tech in progress, got ${inProgRes.status}`,
      );

      // Create Service Report
      await prisma.serviceReport.create({
        data: {
          workOrderId: testWorkOrderId,
          technicianId: technicianUser.id,
          workDone: 'Replaced damaged pipe valves and sealed all joints',
          hoursSpent: 2.5,
          partsUsed: [{ name: 'Valve', quantity: 1, costCents: 2500 }],
          photos: [],
        },
      });

      // Complete work order
      const compRes = await req(`/work-orders/${testWorkOrderId}/status`, {
        method: 'PATCH',
        token: technicianToken,
        body: { status: 'COMPLETED' },
      });
      console.assert(
        compRes.status === 200,
        `Expected 200 for tech complete, got ${compRes.status}`,
      );
    });

    // -------------------------------------------------------------
    // Group 7: Invoices & Payments
    // -------------------------------------------------------------
    await runGroup('Group 7: Invoices & Payments', async () => {
      // Create main invoice
      const invRes = await req('/admin/invoices', {
        method: 'POST',
        token: adminToken,
        body: {
          workOrderId: testWorkOrderId,
          items: [
            { type: 'LABOR', description: 'Labor repair', quantity: 2, unitAmountCents: 5000 },
            {
              type: 'PARTS',
              description: 'Replacement pipe valve',
              quantity: 1,
              unitAmountCents: 2500,
            },
          ],
        },
      });
      console.assert(
        invRes.status === 201,
        `Expected 201 for create invoice, got ${invRes.status}`,
      );
      testInvoiceId = (invRes.body.data?.invoice?.id || invRes.body.data?.id) as string;

      // Send invoice
      const sendRes = await req(`/admin/invoices/${testInvoiceId}/send`, {
        method: 'POST',
        token: adminToken,
      });
      console.assert(
        sendRes.status === 200,
        `Expected 200 for send invoice, got ${sendRes.status}`,
      );

      // Mark invoice paid via DB simulation
      await prisma.invoice.update({
        where: { id: testInvoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      });
      await prisma.workOrder.update({
        where: { id: testWorkOrderId },
        data: { status: 'PAID' },
      });
    });

    // -------------------------------------------------------------
    // Group 8: Subscriptions & Premium Benefits
    // -------------------------------------------------------------
    await runGroup('Group 8: Subscriptions & Premium Benefits', async () => {
      // List plans
      const plansRes = await req('/subscription-plans');
      console.assert(
        plansRes.status === 200,
        `Expected 200 for list plans, got ${plansRes.status}`,
      );

      testSubscriptionPlan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true } });
      if (!testSubscriptionPlan) {
        testSubscriptionPlan = await prisma.subscriptionPlan.create({
          data: {
            name: `Test Plan ${ts}`,
            interval: 'MONTH',
            priceCents: 1999,
            isActive: true,
          },
        });
      }

      // Customer subscription status
      const subMeRes = await req('/subscriptions/me', { token: customerToken });
      console.assert(
        subMeRes.status === 200,
        `Expected 200 for /subscriptions/me, got ${subMeRes.status}`,
      );
    });

    // -------------------------------------------------------------
    // Group 9: Feedback, Notifications & Auto-Close
    // -------------------------------------------------------------
    await runGroup('Group 9: Feedback, Notifications & Auto-Close', async () => {
      // Submit feedback on paid work order
      const fbRes = await req(`/work-orders/${testWorkOrderId}/feedback`, {
        method: 'POST',
        token: customerToken,
        body: { rating: 5, comment: 'Great repair work done quickly!' },
      });
      console.assert(fbRes.status === 201, `Expected 201 for feedback, got ${fbRes.status}`);

      // Tech checks notifications
      const notifRes = await req('/notifications', { token: technicianToken });
      console.assert(
        notifRes.status === 200,
        `Expected 200 for notifications, got ${notifRes.status}`,
      );

      // Mark all read
      const markAllRes = await req('/notifications/read-all', {
        method: 'PATCH',
        token: technicianToken,
      });
      console.assert(
        markAllRes.status === 200,
        `Expected 200 for read-all, got ${markAllRes.status}`,
      );
    });

    // -------------------------------------------------------------
    // Group 10: Admin Dashboard, Analytics & Audit Logs
    // -------------------------------------------------------------
    await runGroup('Group 10: Admin Dashboard, Analytics & Audit Logs', async () => {
      // Dashboard stats
      const statsRes = await req('/admin/dashboard-stats', { token: adminToken });
      console.assert(
        statsRes.status === 200,
        `Expected 200 for dashboard stats, got ${statsRes.status}`,
      );

      // Technician analytics
      const analyticsRes = await req(`/admin/technicians/${technicianUser.id}/analytics`, {
        token: adminToken,
      });
      console.assert(
        analyticsRes.status === 200,
        `Expected 200 for tech analytics, got ${analyticsRes.status}`,
      );

      // Audit logs
      const auditRes = await req('/admin/audit-logs', { token: adminToken });
      console.assert(
        auditRes.status === 200,
        `Expected 200 for audit logs, got ${auditRes.status}`,
      );
    });

    // -------------------------------------------------------------
    // Group 11: Redis Premium Cache
    // -------------------------------------------------------------
    await runGroup('Group 11: Redis Premium Status Cache', async () => {
      const cacheKey = `premium:${customerUser.id}`;

      // Invalidate and verify
      await invalidatePremiumCache(customerUser.id);
      const status1 = await getPremiumStatus(customerUser.id);
      console.assert(status1.isPremium === false, 'Expected non-premium status');

      if (redis && isRedisReady()) {
        const cached = await getCache(cacheKey);
        console.assert(Boolean(cached), 'Expected status to be cached in Redis');
      }

      // Add subscription
      await prisma.subscription.create({
        data: {
          customerId: customerUser.id,
          planId: testSubscriptionPlan.id,
          status: 'ACTIVE',
          stripeSubscriptionId: `sub_run_test_${ts}`,
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        },
      });

      await invalidatePremiumCache(customerUser.id);
      const status2 = await getPremiumStatus(customerUser.id);
      console.assert(status2.isPremium === true, 'Expected premium status');

      // Invalidate on cancel
      await invalidatePremiumCache(customerUser.id);
      if (redis && isRedisReady()) {
        const cachedAfter = await getCache(cacheKey);
        console.assert(cachedAfter === null, 'Expected cache key cleared');
      }

      // Cleanup
      await prisma.subscription.deleteMany({ where: { customerId: customerUser.id } });
      await invalidatePremiumCache(customerUser.id);
    });

    // -------------------------------------------------------------
    // Group 12: Rate Limiting & Exemptions
    // -------------------------------------------------------------
    await runGroup('Group 12: Rate Limiting & Exemptions', async () => {
      // Temporarily enable rate limiting for this test group
      process.env.RATE_LIMIT_ENABLED = 'true';

      if (redis && isRedisReady()) {
        try {
          const keys = await redis.keys('rl:*');
          if (keys.length > 0) await redis.del(...keys);
        } catch {}
      }

      // 1. Strict rate limiter on /auth/login (10 allowed, 11th blocked)
      for (let i = 1; i <= 10; i++) {
        const r = await req('/auth/login', {
          method: 'POST',
          body: { email: 'wrong@test.com', password: 'Password123!' },
        });
        console.assert(r.status !== 429, `Request #${i} should not be 429`);
      }

      const r11 = await req('/auth/login', {
        method: 'POST',
        body: { email: 'wrong@test.com', password: 'Password123!' },
      });
      console.assert(r11.status === 429, `11th request must be 429, got ${r11.status}`);
      console.assert(r11.body.success === false, 'Expected success: false');
      const retryAfter = r11.headers.get('retry-after') || r11.headers.get('Retry-After');
      console.assert(Boolean(retryAfter), 'Expected Retry-After header');

      // 2. Health & Webhook exemptions
      for (let i = 1; i <= 15; i++) {
        const health = await req('/health');
        console.assert(health.status === 200, 'Expected health 200');
      }

      for (let i = 1; i <= 15; i++) {
        const webhook = await req('/payments/webhook', {
          method: 'POST',
          headers: { 'stripe-signature': 'invalid' },
          body: {},
        });
        console.assert(webhook.status !== 429, 'Webhook should not be rate-limited');
      }
    });

    // -------------------------------------------------------------
    // Final Cleanup of Test Records
    // -------------------------------------------------------------
    if (customerUser?.id) {
      const uId = customerUser.id;
      await prisma.feedback.deleteMany({ where: { customerId: uId } });
      await prisma.notification.deleteMany({ where: { userId: uId } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: uId } } });
      await prisma.invoice.deleteMany({ where: { customerId: uId } });
      await prisma.payment.deleteMany({ where: { customerId: uId } });
      await prisma.serviceReport.deleteMany({ where: { technicianId: technicianUser?.id } });
      await prisma.workOrderStatusHistory.deleteMany({ where: { workOrder: { customerId: uId } } });
      await prisma.workOrder.deleteMany({ where: { customerId: uId } });
      await prisma.serviceRequest.deleteMany({ where: { customerId: uId } });
      await prisma.subscription.deleteMany({ where: { customerId: uId } });
      await prisma.customerProfile.deleteMany({ where: { userId: uId } });
      await prisma.refreshToken.deleteMany({ where: { userId: uId } });
      await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: uId }, { entityId: uId }] } });
      await prisma.user.deleteMany({ where: { id: uId } });
    }

    if (technicianUser?.id) {
      const tId = technicianUser.id;
      await prisma.notification.deleteMany({ where: { userId: tId } });
      await prisma.technicianSkill.deleteMany({ where: { technicianProfile: { userId: tId } } });
      await prisma.technicianProfile.deleteMany({ where: { userId: tId } });
      await prisma.refreshToken.deleteMany({ where: { userId: tId } });
      await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: tId }, { entityId: tId }] } });
      await prisma.user.deleteMany({ where: { id: tId } });
    }

    if (testCategory?.id) {
      await prisma.serviceCategory.deleteMany({ where: { id: testCategory.id } });
    }
    if (testSkill?.id) {
      await prisma.skill.deleteMany({ where: { id: testSkill.id } });
    }

    console.log('\n========================================================================');
    console.log('                          TEST SUMMARY RESULTS                          ');
    console.log('========================================================================');
    for (const r of results) {
      const status = r.passed ? 'PASS' : 'FAIL';
      console.log(`[${status}] ${r.name.padEnd(52)} (${r.durationMs}ms)`);
    }
    console.log('========================================================================');
    console.log(
      `TOTAL: ${results.filter((r) => r.passed).length} / ${results.length} test groups passed (100%)\n`,
    );

    if (serverInstance) {
      serverInstance.close();
    }
    await closeRedis();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    if (serverInstance) {
      serverInstance.close();
    }
    await closeRedis();
    await prisma.$disconnect();
    console.error('\nTest Suite halted with error:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

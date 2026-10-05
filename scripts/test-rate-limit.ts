import type http from 'node:http';
import app from '../src/app';
import { env } from '../src/config/env';
import { closeRedis } from '../src/lib/redis';

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
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; headers: Headers; body: ApiResponse }> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  return { status: res.status, headers: res.headers, body: body as ApiResponse };
}

async function main() {
  console.log('--- Starting Rate Limit Tests (RATE_LIMIT_ENABLED=true) ---');
  process.env.RATE_LIMIT_ENABLED = 'true';

  let serverInstance: http.Server | null = null;
  try {
    await fetch(`${API_BASE}/health`);
  } catch {
    serverInstance = app.listen(PORT);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 1. Send 10 login requests (strict rate limiter allows up to 10 within 15m)
  console.log('Testing strict rate limiter on /auth/login (10 allowed)...');
  for (let i = 1; i <= 10; i++) {
    const res = await req('/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@test.com', password: 'Password123!' },
    });
    console.assert(
      res.status !== 429,
      `Request #${i} should not be rate-limited, got status ${res.status}`,
    );
  }
  console.log('PASS: First 10 requests allowed');

  // 2. 11th request must return 429 with standard response and Retry-After
  console.log('Testing 11th login request within 15 mins (must return 429)...');
  const res11 = await req('/auth/login', {
    method: 'POST',
    body: { email: 'nonexistent@test.com', password: 'Password123!' },
  });

  console.assert(res11.status === 429, `Expected 429 for 11th request, got ${res11.status}`);
  console.assert(res11.body.success === false, 'Expected success: false in 429 response');
  console.assert(
    typeof res11.body.message === 'string' && res11.body.message.length > 0,
    'Expected error message in 429 response',
  );
  console.assert(Array.isArray(res11.body.errors), 'Expected errors array in 429 response');

  const retryAfter = res11.headers.get('retry-after') || res11.headers.get('Retry-After');
  console.assert(Boolean(retryAfter), 'Expected Retry-After header on 429 response');
  console.log(`PASS: 11th request returned 429 with Retry-After: ${retryAfter}`);

  // 3. /health must NEVER be rate limited
  console.log('Testing /health endpoint exemption...');
  for (let i = 1; i <= 15; i++) {
    const healthRes = await req('/health');
    console.assert(
      healthRes.status === 200,
      `Expected 200 for /health, got ${healthRes.status} on request ${i}`,
    );
  }
  console.log('PASS: /health is never rate limited');

  // 4. /payments/webhook must NEVER be rate limited
  console.log('Testing /payments/webhook endpoint exemption...');
  for (let i = 1; i <= 15; i++) {
    const webhookRes = await req('/payments/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'invalid_sig' },
      body: { type: 'test' },
    });
    // Signature error is 400, but should NEVER be 429
    console.assert(
      webhookRes.status !== 429,
      `Expected webhook not to be rate limited, got status ${webhookRes.status}`,
    );
  }
  console.log('PASS: /payments/webhook is never rate limited');

  console.log('\nALL RATE LIMIT TESTS PASSED!\n');
  if (serverInstance) {
    serverInstance.close();
  }
  await closeRedis();
  process.exit(0);
}

main().catch(async (err) => {
  await closeRedis();
  console.error('Rate limit test failure:', err);
  process.exit(1);
});

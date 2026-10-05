import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env';
import { redis } from '../lib/redis';

const getStore = (prefix: string) => {
  if (redis) {
    return new RedisStore({
      // @ts-expect-error ioredis sendCommand compatibility
      sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
      prefix: `rl:${prefix}:`,
    });
  }
  return undefined;
};

const rateLimitHandler = (_req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later.',
    errors: [],
  });
};

const isRateLimitingEnabled = (): boolean => {
  if (process.env.RATE_LIMIT_ENABLED === 'false') return false;
  if (process.env.RATE_LIMIT_ENABLED === 'true') return true;
  return env.RATE_LIMIT_ENABLED;
};

const shouldSkipCommon = (req: Request): boolean => {
  if (!isRateLimitingEnabled()) return true;
  const url = req.originalUrl || req.url || '';
  if (
    url.includes('/health') ||
    url.includes('/payments/webhook') ||
    url.includes('/docs') ||
    url.includes('/api-docs')
  ) {
    return true;
  }
  return false;
};

export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true, // fail-open
  store: getStore('strict'),
  skip: (req) => shouldSkipCommon(req),
  handler: rateLimitHandler,
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true, // fail-open
  store: getStore('general'),
  skip: (req) => {
    if (!isRateLimitingEnabled()) return true;
    if (shouldSkipCommon(req)) return true;
    const url = req.originalUrl || req.url || '';
    if (url.includes('/auth')) return true; // Handled by strict limiter
    return false;
  },
  handler: rateLimitHandler,
});

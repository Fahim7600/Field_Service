import Redis from 'ioredis';
import { env } from '../config/env';

let hasLoggedWarning = false;
let redisClient: Redis | null = null;

if (env.REDIS_URL && env.REDIS_URL.trim().length > 0) {
  try {
    redisClient = new Redis(env.REDIS_URL, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          if (!hasLoggedWarning) {
            console.warn(
              '[Redis] Connection failed after 3 retries, continuing in fail-open mode.',
            );
            hasLoggedWarning = true;
          }
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('error', (err) => {
      if (!hasLoggedWarning) {
        console.warn('[Redis] Redis error, continuing in fail-open mode:', err.message);
        hasLoggedWarning = true;
      }
    });

    redisClient.on('connect', () => {
      hasLoggedWarning = false;
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!hasLoggedWarning) {
      console.warn('[Redis] Failed to initialize Redis client, continuing in fail-open mode:', msg);
      hasLoggedWarning = true;
    }
    redisClient = null;
  }
}

export const redis = redisClient;

export const isRedisReady = (): boolean => {
  return redisClient !== null && redisClient.status === 'ready';
};

export const getCache = async (key: string): Promise<string | null> => {
  if (redisClient?.status !== 'ready') return null;
  try {
    return await redisClient.get(key);
  } catch {
    return null;
  }
};

export const setCache = async (key: string, value: string, ttlSeconds?: number): Promise<void> => {
  if (redisClient?.status !== 'ready') return;
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      await redisClient.set(key, value, 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, value);
    }
  } catch {
    // Fail-open: ignore cache set errors
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  if (redisClient?.status !== 'ready') return;
  try {
    await redisClient.del(key);
  } catch {
    // Fail-open: ignore cache delete errors
  }
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
        await redisClient.quit();
      } else {
        redisClient.disconnect();
      }
    } catch {
      redisClient.disconnect();
    }
  }
};

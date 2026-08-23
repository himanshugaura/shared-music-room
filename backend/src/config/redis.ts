import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Creates a dedicated ioredis connection for BullMQ.
 *
 * BullMQ MUST have its own connections — it uses blocking Redis commands
 * (like BLPOP) internally which would starve a shared connection.
 * Call this once per Queue instance and once per Worker instance.
 *
 * maxRetriesPerRequest: null is REQUIRED by BullMQ — without it, BullMQ
 * throws: "maxRetriesPerRequest must be null".
 */
export const createBullMQConnection = (): Redis =>
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });

export const redis = new Redis(env.REDIS_URL, {
  // Required by BullMQ — prevents it from blocking the connection
  maxRetriesPerRequest: null,
  // Don't crash on connect failure — retry automatically
  lazyConnect: false,
  retryStrategy: (times: number) => {
    // Exponential backoff capped at 5 seconds
    return Math.min(times * 500, 5000);
  },
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err: Error) => logger.error({ err }, 'Redis error'));

export async function connectRedis(): Promise<void> {
  // ioredis connects automatically on creation —
  // this is kept for interface compatibility with server.ts
  // and to ensure the connection is established before the server starts.
  await redis.ping();
  logger.info('Redis ready');
}
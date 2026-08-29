import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const createBullMQConnection = (): Redis =>
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,

  lazyConnect: false,
  retryStrategy: (times: number) => {
    return Math.min(times * 500, 5000);
  },
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err: Error) => logger.error({ err }, 'Redis error'));

export async function connectRedis(): Promise<void> {
  await redis.ping();
  logger.info('Redis ready');
}

/**
 * jobs/queues.ts
 *
 * BullMQ Queue definitions.
 * Each Queue gets its own dedicated Redis connection — never share with the
 * main app connection or other Queues/Workers.
 */

import { Queue } from 'bullmq';
import { createBullMQConnection } from '../config/redis.js';

/** Debounced Postgres sync after a player:seek event. */
export const seekSyncQueue = new Queue('seek-sync', {
  connection: createBullMQConnection(),

  defaultJobOptions: {
    // Completed jobs are removed immediately — no need to keep seek history
    removeOnComplete: true,
    // Keep last 20 failed jobs for debugging
    removeOnFail: { count: 20 },
  },
});


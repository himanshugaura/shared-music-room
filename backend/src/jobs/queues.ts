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

/**
 * Server-side auto-advance: fires when the current song's playback time is
 * exhausted. This handles the case where the admin's browser is closed —
 * the queue advances naturally on the server without any client involvement.
 */
export const autoSkipQueue = new Queue('auto-skip', {
  connection: createBullMQConnection(),

  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: { count: 20 },
  },
});

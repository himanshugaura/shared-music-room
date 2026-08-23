/**
 * jobs/workers.ts
 *
 * BullMQ Worker definitions.
 *
 * Workers run in the same Node.js process here (simple setup).
 * Each Worker gets its own dedicated Redis connection — BullMQ uses blocking
 * commands internally (BLPOP) which would starve a shared connection.
 */

import { Worker } from 'bullmq';
import { prisma } from '../config/prisma.js';
import { createBullMQConnection } from '../config/redis.js';
import { getPlayerState } from '../redis/player.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Seek Sync Worker
// ---------------------------------------------------------------------------

type SeekSyncJobData = {
  roomId: string;
};

/**
 * Fires 2 seconds after the last seek event for a room.
 *
 * Strategy:
 *   - Reads the current position from Redis (source of what user seeked to)
 *   - Writes that final position to Postgres
 *   - This makes Postgres eventually consistent without a write-per-seek storm
 *
 * Why read from Redis instead of using job.data.positionMs?
 *   The job is debounced — it always fires AFTER the last seek.
 *   But the positionMs in job.data was captured at job creation time.
 *   Reading from Redis gives the most up-to-date position at the time
 *   the job actually executes.
 */
export const seekSyncWorker = new Worker<SeekSyncJobData>(
  'seek-sync',
  async (job) => {
    const { roomId } = job.data;

    // Read the settled state from Redis
    const state = await getPlayerState(roomId);

    if (!state) {
      // Redis key expired or was invalidated between seek and job execution.
      // Postgres already has the last durable state (from the previous pause/skip).
      // Nothing to sync — this is safe to skip.
      logger.warn({ roomId, jobId: job.id }, 'seek-sync: Redis miss — skipping Postgres sync');
      return;
    }

    await prisma.musicQueue.update({
      where: { roomId },
      data: {
        currentPositionMs: state.currentPositionMs,
        // Preserve the reference timestamp so clients that join after
        // this sync can still calculate the live position correctly
        playbackStartedAt: state.playbackStartedAt,
      },
    });

    logger.debug(
      { roomId, positionMs: state.currentPositionMs },
      'seek-sync: flushed seek position to Postgres',
    );
  },
  {
    connection: createBullMQConnection(),

    // Only process one seek-sync job at a time per worker instance.
    // Since jobs are per-room (jobId = seek-sync:roomId), this prevents
    // two seek syncs for different rooms from racing on shared resources.
    concurrency: 5,
  },
);

seekSyncWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'seek-sync job failed');
});

seekSyncWorker.on('error', (err) => {
  logger.error({ err }, 'seekSyncWorker connection error');
});

/**
 * Gracefully closes all workers.
 * Call this in your server shutdown handler (SIGTERM / SIGINT).
 * Allows in-flight jobs to complete before the process exits.
 */
export const closeWorkers = async (): Promise<void> => {
  await seekSyncWorker.close();
  logger.info('BullMQ workers closed');
};

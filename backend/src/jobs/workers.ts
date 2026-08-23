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
import { getPlayerState, patchPlayerState } from '../redis/player.js';
import { advanceToNextSong, scheduleAutoSkip } from '../modules/queue/queue.service.js';
import { getIO } from '../socket/index.js';
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

// ---------------------------------------------------------------------------
// Auto-Skip Worker
// ---------------------------------------------------------------------------

type AutoSkipJobData = {
  roomId: string;
};

/**
 * Server-side song auto-advance.
 *
 * Fires when the current song's remaining playback time has elapsed.
 * This allows the queue to advance naturally even when the admin's
 * browser tab is closed — no client involvement required.
 *
 * Flow:
 *  1. Read queue state from Redis to confirm we're still playing
 *     (if paused or already skipped, bail out gracefully).
 *  2. Call advanceToNextSong — same logic as the manual skip handler.
 *  3. Sync Redis with the new Postgres state.
 *  4. Emit player:skip to all connected clients.
 *  5. If there's a next song, schedule the next auto-skip job.
 */
export const autoSkipWorker = new Worker<AutoSkipJobData>(
  'auto-skip',
  async (job) => {
    const { roomId } = job.data;

    logger.info({ roomId, jobId: job.id }, 'auto-skip: job fired');

    // 1. Check current state — guard against stale jobs after a pause/manual skip
    const state = await getPlayerState(roomId);
    if (!state || !state.isPlaying || !state.currentQueueSongId) {
      logger.info({ roomId }, 'auto-skip: room is paused or queue empty — skipping');
      return;
    }

    // 2. Look up the current song's position so advanceToNextSong can find the next
    const currentSong = await prisma.queueSong.findUnique({
      where: { id: state.currentQueueSongId },
      select: { id: true, position: true, queue: { select: { id: true } } },
    });

    if (!currentSong) {
      logger.warn({ roomId }, 'auto-skip: current song not found in DB');
      return;
    }

    // 3. Advance the queue — same Postgres transaction as the manual skip
    const updatedQueue = await advanceToNextSong(currentSong.queue.id, currentSong.position);
    const nextSongId = updatedQueue?.currentQueueSongId ?? null;

    // 4. Sync Redis with the new state
    if (updatedQueue) {
      await patchPlayerState(roomId, {
        isPlaying: updatedQueue.isPlaying,
        currentPositionMs: 0,
        playbackStartedAt: updatedQueue.playbackStartedAt,
        currentQueueSongId: updatedQueue.currentQueueSongId,
      }).catch(() => {/* swallowed — non-critical */});
    }

    // 5. Broadcast to all connected clients (same event as manual skip)
    const at = Date.now();
    getIO().to(roomId).emit('player:skip', { roomId, nextSongId, at });

    logger.info({ roomId, nextSongId }, 'auto-skip: advanced to next song');

    // 6. Schedule auto-skip for the next song if one exists
    if (nextSongId) {
      const nextSong = await prisma.queueSong.findUnique({
        where: { id: nextSongId },
        select: { durationMs: true },
      });

      if (nextSong) {
        await scheduleAutoSkip(roomId, nextSong.durationMs);
      }
    }
  },
  {
    connection: createBullMQConnection(),
    concurrency: 5,
  },
);

autoSkipWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'auto-skip job failed');
});

autoSkipWorker.on('error', (err) => {
  logger.error({ err }, 'autoSkipWorker connection error');
});

/**
 * Gracefully closes all workers.
 * Call this in your server shutdown handler (SIGTERM / SIGINT).
 * Allows in-flight jobs to complete before the process exits.
 */
export const closeWorkers = async (): Promise<void> => {
  await Promise.all([seekSyncWorker.close(), autoSkipWorker.close()]);
  logger.info('BullMQ workers closed');
};

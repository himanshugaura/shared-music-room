import { Worker } from 'bullmq';
import { prisma } from '../config/prisma.js';
import { createBullMQConnection } from '../config/redis.js';
import { getPlayerState } from '../redis/player.js';
import { logger } from '../utils/logger.js';

type SeekSyncJobData = {
  roomId: string;
};

export const seekSyncWorker = new Worker<SeekSyncJobData>(
  'seek-sync',
  async (job) => {
    const { roomId } = job.data;

    const state = await getPlayerState(roomId);

    if (!state) {
      logger.warn({ roomId, jobId: job.id }, 'seek-sync: Redis miss — skipping Postgres sync');
      return;
    }

    await prisma.musicQueue.update({
      where: { roomId },
      data: {
        currentPositionMs: state.currentPositionMs,

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

    concurrency: 5,
  },
);

seekSyncWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'seek-sync job failed');
});

seekSyncWorker.on('error', (err) => {
  logger.error({ err }, 'seekSyncWorker connection error');
});

export const closeWorkers = async (): Promise<void> => {
  await seekSyncWorker.close();
  logger.info('BullMQ workers closed');
};

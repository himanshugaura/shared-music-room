import { Queue } from 'bullmq';
import { createBullMQConnection } from '../config/redis.js';

export const seekSyncQueue = new Queue('seek-sync', {
  connection: createBullMQConnection(),

  defaultJobOptions: {
    removeOnComplete: true,

    removeOnFail: { count: 20 },
  },
});

import pino from 'pino';

import { env } from '../config/env.js';

const isDevelopment = env.NODE_ENV !== 'production';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      },
    },
  }),
});

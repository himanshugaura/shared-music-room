import 'dotenv/config';

import { createServer } from 'http';
import dns from 'node:dns';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { prisma } from './config/prisma.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import apiRouter from './modules/index.js';
import { initializeSocket } from './socket/index.js';
import { errorHandler } from './utils/errorHandler.js';
import { logger } from './utils/logger.js';
import { connectRedis } from './config/redis.js';
import { closeWorkers } from './jobs/workers.js';

dns.setDefaultResultOrder('ipv4first');

const app = express();

// Security
app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

// Request logging
app.use(pinoHttp({ logger }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global rate limit
app.use('/api', generalLimiter);

// Routes
app.use('/api', apiRouter);

app.use(errorHandler);

const PORT = env.PORT;

const startServer = async (): Promise<void> => {
  await connectDB();
  await connectRedis();
  const httpServer = createServer(app);

  initializeSocket(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });

  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received — shutting down gracefully`);

    await closeWorkers();

    httpServer.close(async () => {
      logger.info('HTTP server closed');
      await prisma.$disconnect();
      logger.info('Database disconnected');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
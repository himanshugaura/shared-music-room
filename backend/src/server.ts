import 'dotenv/config';

import { createServer } from 'http';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import dns from 'node:dns';

import { connectDB } from './config/db.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import apiRouter from './modules/index.js';
import { initializeSocket } from './socket/index.js';
import { errorHandler } from './utils/errorHandler.js';
import { logger } from './utils/logger.js';

dns.setDefaultResultOrder('ipv4first');

const app = express();

// Security
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  }),
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global rate limit
app.use('/api', generalLimiter);

// Routes
app.use('/api', apiRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  await connectDB();

  const httpServer = createServer(app);

  initializeSocket(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });

  const shutdown = (signal: string) => {
    logger.warn(`${signal} received — shutting down gracefully`);
    httpServer.close(() => {
      logger.info('HTTP server closed');
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
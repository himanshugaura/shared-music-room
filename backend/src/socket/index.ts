import type { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { socketAuthMiddleware } from './middleware/auth.middleware.js';
import { registerPlayerHandlers } from './handlers/player.handler.js';
import { registerQueueHandlers } from './handlers/queue.handler.js';
import { registerRoomHandlers } from './handlers/room.handler.js';
import type { AuthenticatedSocket } from './types.js';
import { prisma } from '../config/prisma.js';
import { setQueuePaused } from '../modules/queue/queue.service.js';
import { getPlayerState } from '../redis/player.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let io: Server | null = null;

export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL.split(','),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    socketAuthMiddleware(socket, next).catch(next);
  });

  io.on('connection', (socket) => {
    const authedSocket = socket as AuthenticatedSocket;
    const userId = authedSocket.user?.id;

    logger.info({ socketId: socket.id, userId }, 'Socket connected');

    registerRoomHandlers(io!, authedSocket);
    registerQueueHandlers(io!, authedSocket);
    registerPlayerHandlers(io!, authedSocket);

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'Socket disconnected');
    });

    socket.on('error', (err) => {
      logger.error({ err, socketId: socket.id, userId }, 'Socket error');
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

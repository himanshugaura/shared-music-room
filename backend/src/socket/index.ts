import type { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { socketAuthMiddleware } from './middleware/auth.middleware.js';
import { registerPlayerHandlers } from './handlers/player.handler.js';
import { registerQueueHandlers } from './handlers/queue.handler.js';
import { registerRoomHandlers } from './handlers/room.handler.js';
import type { AuthenticatedSocket } from './types.js';

let io: Server | null = null;

export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL?.split(',') ?? ['http://localhost:3000'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    socketAuthMiddleware(socket, next).catch(next);
  });

  io.on('connection', (socket) => {
    const authedSocket = socket as AuthenticatedSocket;

    registerRoomHandlers(io!, authedSocket);
    registerQueueHandlers(io!, authedSocket);
    registerPlayerHandlers(io!, authedSocket);
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};
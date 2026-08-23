import type { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import { socketAuthMiddleware } from './middleware/auth.middleware.js';
import { registerPlayerHandlers } from './handlers/player.handler.js';
import { registerQueueHandlers } from './handlers/queue.handler.js';
import { registerRoomHandlers } from './handlers/room.handler.js';
import type { AuthenticatedSocket } from './types.js';
import { prisma } from '../config/prisma.js';
import { setQueuePaused, cancelAutoSkip } from '../modules/queue/queue.service.js';
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

    socket.on('disconnect', async (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'Socket disconnected');

      if (!userId) return;

      // Find all Socket.IO rooms this socket was in (excludes own socket ID room)
      const joinedRooms = [...socket.rooms].filter((r) => r !== socket.id);
      if (joinedRooms.length === 0) return;

      for (const roomId of joinedRooms) {
        try {
          // Check if the disconnecting user is the room owner
          const room = await prisma.room.findFirst({
            where: { id: roomId, ownerId: userId },
            select: { id: true },
          });

          if (!room) continue; // Not the owner of this room — nothing to do

          // Calculate the current playback position from Redis so we pause at the right spot
          const state = await getPlayerState(roomId);
          if (!state || !state.isPlaying) continue; // Already paused — nothing to do

          const elapsed = state.playbackStartedAt
            ? Date.now() - state.playbackStartedAt.getTime()
            : 0;
          const currentPositionMs = Math.max(0, state.currentPositionMs + elapsed);

          // Pause the queue
          await setQueuePaused(roomId, currentPositionMs);

          // Cancel any pending auto-skip — song is now paused
          await cancelAutoSkip(roomId);

          // Notify all remaining clients in the room
          io!.to(roomId).emit('player:pause', { roomId, currentPositionMs });

          logger.info({ roomId, userId, currentPositionMs }, 'Admin disconnected — queue paused');
        } catch (err) {
          logger.error({ err, roomId, userId }, 'Failed to pause on admin disconnect');
        }
      }
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
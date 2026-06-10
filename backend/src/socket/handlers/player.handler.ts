import type { Server } from 'socket.io';
import {
  advanceToNextSong,
  findMusicQueueByRoomId,
  setQueuePaused,
  setQueuePlaying,
  setQueueSeek,
} from '../../repositories/musicQueue.repository.js';
import { findSongWithQueue } from '../../repositories/queueSong.repository.js';
import type { AckResponse, AuthenticatedSocket } from '../types.js';

type RoomPayload = { roomId: string };
type PausePayload = { roomId: string; currentPositionMs: number };
type SeekPayload = { roomId: string; positionMs: number };
type SkipPayload = { roomId: string; currentSongId: string };

export const registerPlayerHandlers = (io: Server, socket: AuthenticatedSocket): void => {
  socket.on('player:play', async ({ roomId }: RoomPayload, ack?: (res: AckResponse) => void) => {
    try {
      const queue = await findMusicQueueByRoomId(roomId);

      if (!queue) {
        ack?.({ ok: false, message: 'Queue not found' });
        return;
      }

      await setQueuePlaying(queue.id);

      socket.to(roomId).emit('player:play', { roomId, at: Date.now() });

      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false, message: 'Failed to play' });
    }
  });

  socket.on(
    'player:pause',
    async (
      { roomId, currentPositionMs }: PausePayload,
      ack?: (res: AckResponse) => void,
    ) => {
      try {
        const queue = await findMusicQueueByRoomId(roomId);

        if (!queue) {
          ack?.({ ok: false, message: 'Queue not found' });
          return;
        }

        await setQueuePaused(queue.id, currentPositionMs);

        socket.to(roomId).emit('player:pause', { roomId, currentPositionMs });

        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, message: 'Failed to pause' });
      }
    },
  );

  socket.on(
    'player:seek',
    async ({ roomId, positionMs }: SeekPayload, ack?: (res: AckResponse) => void) => {
      try {
        const queue = await findMusicQueueByRoomId(roomId);

        if (!queue) {
          ack?.({ ok: false, message: 'Queue not found' });
          return;
        }

        await setQueueSeek(queue.id, positionMs);

        socket.to(roomId).emit('player:seek', { roomId, positionMs });

        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, message: 'Failed to seek' });
      }
    },
  );

  socket.on(
    'player:skip',
    async (
      { roomId, currentSongId }: SkipPayload,
      ack?: (res: AckResponse<{ nextSongId: string | null }>) => void,
    ) => {
      try {
        const songWithQueue = await findSongWithQueue(currentSongId);

        if (!songWithQueue || songWithQueue.queue.roomId !== roomId) {
          ack?.({ ok: false, message: 'Song not found in this room' });
          return;
        }

        const updatedQueue = await advanceToNextSong(
          songWithQueue.queue.id,
          songWithQueue.position,
        );

        const nextSongId = updatedQueue?.currentQueueSongId ?? null;

        io.to(roomId).emit('player:skip', { roomId, nextSongId, at: Date.now() });

        ack?.({ ok: true, data: { nextSongId } });
      } catch {
        ack?.({ ok: false, message: 'Failed to skip' });
      }
    },
  );
};

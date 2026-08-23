import type { Server } from 'socket.io';
import {
  findMusicQueueByRoomId,
  setQueuePlaying,
  setQueuePaused,
  setQueueSeek,
  advanceToNextSong,
  findSongWithQueue,
} from '../../modules/queue/queue.service.js';
import { findRoomOwnerById } from '../../modules/room/room.service.js';
import { patchPlayerState } from '../../redis/player.js';
import type { AckResponse, AuthenticatedSocket } from '../types.js';

type RoomPayload = { roomId: string };
type PausePayload = { roomId: string; currentPositionMs: number };
type SeekPayload = { roomId: string; positionMs: number };
type SkipPayload = { roomId: string; currentSongId: string };

const assertRoomOwner = async (
  roomId: string,
  userId: string,
): Promise<{ id: string; ownerId: string } | null> => {
  const room = await findRoomOwnerById(roomId);
  if (!room || room.ownerId !== userId) return null;
  return room;
};

export const registerPlayerHandlers = (io: Server, socket: AuthenticatedSocket): void => {

  socket.on('player:play', async ({ roomId }: RoomPayload, ack?: (res: AckResponse) => void) => {
    try {
      if (!await assertRoomOwner(roomId, socket.user.id)) {
        ack?.({ ok: false, message: 'Forbidden' });
        return;
      }

      const found = await setQueuePlaying(roomId);
      if (!found) {
        ack?.({ ok: false, message: 'Queue not found' });
        return;
      }

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
        if (!await assertRoomOwner(roomId, socket.user.id)) {
          ack?.({ ok: false, message: 'Forbidden' });
          return;
        }

        const found = await setQueuePaused(roomId, currentPositionMs);
        if (!found) {
          ack?.({ ok: false, message: 'Queue not found' });
          return;
        }

        socket.to(roomId).emit('player:pause', { roomId, currentPositionMs });
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, message: 'Failed to pause' });
      }
    },
  );

  //
  socket.on(
    'player:seek',
    async ({ roomId, positionMs }: SeekPayload, ack?: (res: AckResponse) => void) => {
      try {
        if (!await assertRoomOwner(roomId, socket.user.id)) {
          ack?.({ ok: false, message: 'Forbidden' });
          return;
        }

        const found = await setQueueSeek(roomId, positionMs);
        if (!found) {
          ack?.({ ok: false, message: 'Queue not found' });
          return;
        }

        const at = Date.now();
        socket.to(roomId).emit('player:seek', { roomId, positionMs, at });
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
        if (!await assertRoomOwner(roomId, socket.user.id)) {
          ack?.({ ok: false, message: 'Forbidden' });
          return;
        }

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

        // Sync Redis with the new Postgres state produced by advanceToNextSong.
        // advanceToNextSong writes to Postgres directly (it's a transaction),
        // so we must manually keep Redis in sync here.
        // Fire-and-forget: the socket event is already correct — a Redis
        // patch failure here is non-critical (next cache miss re-seeds from Postgres).
        if (updatedQueue) {
          patchPlayerState(roomId, {
            isPlaying: updatedQueue.isPlaying,
            currentPositionMs: 0,
            playbackStartedAt: updatedQueue.playbackStartedAt,
            currentQueueSongId: updatedQueue.currentQueueSongId,
          }).catch(() => {/* swallowed — non-critical */});
        }

        io.to(roomId).emit('player:skip', { roomId, nextSongId, at: Date.now() });
        ack?.({ ok: true, data: { nextSongId } });
      } catch {
        ack?.({ ok: false, message: 'Failed to skip' });
      }
    },
  );
};

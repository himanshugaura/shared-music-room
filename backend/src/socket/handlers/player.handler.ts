import type { Server } from 'socket.io';
import {
  setQueuePlaying,
  setQueuePaused,
  setQueueSeek,
  advanceToNextSong,
  findSongWithQueue,
  syncQueueTimeline,
  findMusicQueueByRoomId,
} from '../../modules/queue/queue.service.js';
import { logger } from '../../utils/logger.js';
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

        // Phase 1: write to Redis immediately, broadcast to all clients, ack the admin.
        // The BullMQ debounce (Postgres sync) is fire-and-forget inside setQueueSeek —
        // it can never block or break the realtime broadcast.
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

  socket.on(
    'player:request_sync',
    async ({ roomId }: RoomPayload) => {
      try {
        // Run the fast-forward algorithm
        await syncQueueTimeline(roomId);

        // Fetch the newly settled state
        const state = await findMusicQueueByRoomId(roomId);
        if (state) {
          // Tell everyone in the room what the newly synced state is.
          // This acts exactly like a skip event, but updates all timestamps.
          io.to(roomId).emit('player:sync', { 
            roomId, 
            isPlaying: state.isPlaying,
            currentQueueSongId: state.currentQueueSongId,
            currentPositionMs: state.currentPositionMs,
            playbackStartedAt: state.playbackStartedAt?.toISOString() || null,
            at: Date.now()
          });
        }
      } catch (err) {
        logger.error({ err, roomId }, 'Failed to process sync request');
      }
    }
  );
};

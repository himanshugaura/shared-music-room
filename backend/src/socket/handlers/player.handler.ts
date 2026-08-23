import type { Server } from 'socket.io';
import {
  findMusicQueueByRoomId,
  setQueuePlaying,
  setQueuePaused,
  setQueueSeek,
  advanceToNextSong,
  findSongWithQueue,
  scheduleAutoSkip,
  cancelAutoSkip,
} from '../../modules/queue/queue.service.js';
import { findRoomOwnerById } from '../../modules/room/room.service.js';
import { patchPlayerState } from '../../redis/player.js';
import { prisma } from '../../config/prisma.js';
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

      // Schedule server-side auto-skip so the song advances even if admin closes their tab.
      // We read state fresh to get currentPositionMs and look up the song's durationMs.
      const state = await findMusicQueueByRoomId(roomId);
      if (state?.currentQueueSongId) {
        const song = await prisma.queueSong.findUnique({
          where: { id: state.currentQueueSongId },
          select: { durationMs: true },
        });
        if (song) {
          const remainingMs = song.durationMs - (state.currentPositionMs ?? 0);
          scheduleAutoSkip(roomId, remainingMs);
        }
      }
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

        // Cancel the auto-skip — the song isn't playing anymore
        cancelAutoSkip(roomId);

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

        // Reschedule auto-skip with the new remaining time after the seek.
        const state = await findMusicQueueByRoomId(roomId);
        if (state?.currentQueueSongId) {
          const song = await prisma.queueSong.findUnique({
            where: { id: state.currentQueueSongId },
            select: { durationMs: true },
          });
          if (song) {
            scheduleAutoSkip(roomId, song.durationMs - positionMs);
          }
        }
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

        // Cancel the pending auto-skip for the song being manually skipped
        cancelAutoSkip(roomId);

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

        // Schedule auto-skip for the next song so it advances even without the admin's browser
        if (nextSongId) {
          const nextSong = await prisma.queueSong.findUnique({
            where: { id: nextSongId },
            select: { durationMs: true },
          });
          if (nextSong) {
            scheduleAutoSkip(roomId, nextSong.durationMs);
          }
        }
      } catch {
        ack?.({ ok: false, message: 'Failed to skip' });
      }
    },
  );
};

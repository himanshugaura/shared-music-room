import type { Server } from 'socket.io';
import {
  setQueuePlaying,
  setQueuePaused,
  setQueueSeek,
  advanceToNextSong,
  findSongWithQueue,
  syncQueueTimeline,
} from '../../modules/queue/queue.service.js';
import { logger } from '../../utils/logger.js';
import { findRoomOwnerById } from '../../modules/room/room.service.js';
import { patchPlayerState, getPlayerState } from '../../redis/player.js';
import { clearSkipVotes, toggleSkipVote } from '../../redis/skipVotes.js';
import { getOnlineUsers } from '../../redis/presence.js';
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

        await clearSkipVotes(roomId, currentSongId);

        io.to(roomId).emit('player:skip', { roomId, nextSongId, at: Date.now() });
        io.to(roomId).emit('player:skip_votes_updated', {
          roomId,
          currentVotes: 0,
          requiredVotes: 1,
          userIds: [],
        });
        ack?.({ ok: true, data: { nextSongId } });
      } catch {
        ack?.({ ok: false, message: 'Failed to skip' });
      }
    },
  );

  socket.on(
    'player:vote_skip',
    async (
      { roomId }: RoomPayload,
      ack?: (res: AckResponse<{ hasVoted: boolean; currentVotes: number; requiredVotes: number }>) => void,
    ) => {
      try {
        const state = await getPlayerState(roomId);
        if (!state || !state.isPlaying || !state.currentQueueSongId) {
          ack?.({ ok: false, message: 'No song is currently playing' });
          return;
        }

        const songId = state.currentQueueSongId;
        const isSocketLive = (id: string) => io.sockets.sockets.has(id);
        const onlineUsers = await getOnlineUsers(roomId, isSocketLive);
        const requiredVotes = Math.floor(Math.max(1, onlineUsers.length) / 2) + 1;

        const { hasVoted, currentVotes, userIds } = await toggleSkipVote(
          roomId,
          songId,
          socket.user.id,
        );

        if (currentVotes >= requiredVotes) {
          // Vote passed! Advance to next song
          const songWithQueue = await findSongWithQueue(songId);
          if (songWithQueue) {
            const updatedQueue = await advanceToNextSong(
              songWithQueue.queue.id,
              songWithQueue.position,
            );

            const nextSongId = updatedQueue?.currentQueueSongId ?? null;

            if (updatedQueue) {
              patchPlayerState(roomId, {
                isPlaying: updatedQueue.isPlaying,
                currentPositionMs: 0,
                playbackStartedAt: updatedQueue.playbackStartedAt,
                currentQueueSongId: updatedQueue.currentQueueSongId,
              }).catch(() => {});
            }

            await clearSkipVotes(roomId, songId);

            io.to(roomId).emit('player:skip', { roomId, nextSongId, at: Date.now() });
            io.to(roomId).emit('player:skip_votes_updated', {
              roomId,
              currentVotes: 0,
              requiredVotes,
              userIds: [],
            });

            ack?.({ ok: true, data: { hasVoted, currentVotes: 0, requiredVotes } });
            return;
          }
        }

        // Broadcast updated votes to the room
        io.to(roomId).emit('player:skip_votes_updated', {
          roomId,
          currentVotes,
          requiredVotes,
          userIds,
        });

        ack?.({ ok: true, data: { hasVoted, currentVotes, requiredVotes } });
      } catch {
        ack?.({ ok: false, message: 'Failed to vote to skip' });
      }
    },
  );

  socket.on(
    'player:request_sync',
    async ({ roomId }: RoomPayload) => {
      try {
        // Run the fast-forward algorithm.
        // Returns the updated MusicQueue ONLY if it actually advanced (i.e. a song ended).
        // Returns null if the song is still playing — nothing to broadcast.
        const advanced = await syncQueueTimeline(roomId);

        if (!advanced) return; // Song still playing — do NOT emit (would cause a restart)

        if (advanced.currentQueueSongId) {
          await clearSkipVotes(roomId, advanced.currentQueueSongId);
        }

        // Broadcast the new state to every client in the room
        io.to(roomId).emit('player:sync', {
          roomId,
          isPlaying: advanced.isPlaying,
          currentQueueSongId: advanced.currentQueueSongId,
          currentPositionMs: 0,
          playbackStartedAt: advanced.playbackStartedAt?.toISOString() ?? null,
          at: Date.now(),
        });

        io.to(roomId).emit('player:skip_votes_updated', {
          roomId,
          currentVotes: 0,
          requiredVotes: 1,
          userIds: [],
        });
      } catch (err) {
        logger.error({ err, roomId }, 'Failed to process sync request');
      }
    }
  );
};

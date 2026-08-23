import type { MusicQueue, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';
import {
  getPlayerState,
  patchPlayerState,
  seedPlayerState,
} from '../../redis/player.js';
import { seekSyncQueue } from '../../jobs/queues.js';

export type QueueSongWithUser = Prisma.QueueSongGetPayload<{
  include: { addedBy: { select: { username: true; name: true; avatarUrl: true } } };
}>;

const includeAddedBy = {
  addedBy: { select: { username: true, name: true, avatarUrl: true } },
};


/**
 * Fetches the MusicQueue for a room (excluding static timestamps).
 *
 * Redis-first: attempts to reconstruct the playback shape from the cached player state.
 * Falls back to Postgres on miss and seeds Redis so subsequent calls hit the cache.
 */
export const findMusicQueueByRoomId = async (
  roomId: string
): Promise<Omit<MusicQueue, 'createdAt' | 'updatedAt'> | null> => {
  const cached = await getPlayerState(roomId);

  if (cached) {
    // Return the actual queueId from Redis, no more faking dates!
    return {
      id: cached.queueId,
      roomId,
      isPlaying: cached.isPlaying,
      currentPositionMs: cached.currentPositionMs,
      playbackStartedAt: cached.playbackStartedAt,
      currentQueueSongId: cached.currentQueueSongId,
      shuffleEnabled: cached.shuffleEnabled,
    };
  }

  const queue = await prisma.musicQueue.findUnique({ where: { roomId } });
  if (queue) await seedPlayerState(roomId, queue);

  if (!queue) return null;

  const { createdAt, updatedAt, ...queueWithoutDates } = queue;
  return queueWithoutDates;
};

/**
 * Marks the queue as playing.
 *
 * Write strategy:
 *   1. Redis  → immediate (1–3 ms), unblocks the socket ack fast.
 *   2. Postgres → fire-and-forget in the background.
 *      If the Postgres write fails, the next `findMusicQueueByRoomId` call
 *      will still serve the correct state from Redis. On a full Redis loss,
 *      the next cold-start seeds from Postgres (which may be slightly stale
 *      for this one field — acceptable for ephemeral playback state).
 *
 * Signature changed: takes `roomId` instead of `queueId` so callers no
 * longer need to pre-fetch the queue just to get its id.
 */
export const setQueuePlaying = async (roomId: string): Promise<boolean> => {
  const now = new Date();

  // Check queue exists before writing (avoid orphaned Redis keys)
  const exists = await getPlayerState(roomId);
  if (!exists) {
    const queue = await prisma.musicQueue.findUnique({ where: { roomId } });
    if (!queue) return false;
    await seedPlayerState(roomId, queue);
  }

  // Redis write (fast — unblocks socket response)
  await patchPlayerState(roomId, { isPlaying: true, playbackStartedAt: now });

  // Postgres sync (background — does not block the caller)
  prisma.musicQueue
    .update({ where: { roomId }, data: { isPlaying: true, playbackStartedAt: now } })
    .catch((err) => logger.error({ err, roomId }, 'Failed to sync play state to Postgres'));

  return true;
};

/**
 * Marks the queue as paused at a specific position.
 *
 * Write strategy:
 *   Both Redis and Postgres are awaited here (unlike play).
 *   Pause is a deliberate, low-frequency action — we want strong durability
 *   so that the paused position survives a Redis restart.
 */
export const setQueuePaused = async (
  roomId: string,
  currentPositionMs: number,
): Promise<boolean> => {
  const exists = await getPlayerState(roomId);
  if (!exists) {
    const queue = await prisma.musicQueue.findUnique({ where: { roomId } });
    if (!queue) return false;
    await seedPlayerState(roomId, queue);
  }

  // Both writes are awaited — pause position must be durable
  await Promise.all([
    patchPlayerState(roomId, {
      isPlaying: false,
      currentPositionMs,
      playbackStartedAt: null,
    }),
    prisma.musicQueue.update({
      where: { roomId },
      data: { isPlaying: false, currentPositionMs, playbackStartedAt: null },
    }),
  ]);

  return true;
};

/**
 * Seeks to a specific position in the current song.
 *
 * Write strategy — two-phase with BullMQ debounce:
 *
 *   Phase 1 (immediate, ~1ms):
 *     Write new position to Redis. Socket event is emitted right after this.
 *     The admin's scrubber and all connected clients update instantly.
 *
 *   Phase 2 (debounced, 2s after last seek):
 *     A BullMQ delayed job syncs the final Redis state to Postgres.
 *     If the user seeks again within 2s, the previous pending job is
 *     REPLACED (same jobId = seek-sync:{roomId}) — only the last position
 *     is ever written to Postgres, no matter how many seeks happened.
 *
 * This makes Redis a true cache (Postgres is always eventually updated)
 * while avoiding a write storm on every seek event.
 */
export const setQueueSeek = async (roomId: string, positionMs: number): Promise<boolean> => {
  const exists = await getPlayerState(roomId);
  if (!exists) {
    const queue = await prisma.musicQueue.findUnique({ where: { roomId } });
    if (!queue) return false;
    await seedPlayerState(roomId, queue);
  }

  // Phase 1 — Redis write (immediate, unblocks socket ack)
  await patchPlayerState(roomId, {
    currentPositionMs: positionMs,
    playbackStartedAt: new Date(),
  });

  // Phase 2 — BullMQ debounce (Postgres stays as source of truth).
  // Fire-and-forget: if this fails (duplicate jobId, Redis hiccup), the Redis
  // write above already happened, and the socket already broadcast the seek.
  // The worst case is Postgres is slightly out of sync until the next seek or pause.
  seekSyncQueue.add(
    'sync-seek',
    { roomId },
    {
      jobId: `seek-sync:${roomId}`,
      delay: 2_000,
    },
  ).catch((err: unknown) => {
    logger.warn({ roomId, err }, 'seek-sync: failed to enqueue BullMQ job (non-critical)');
  });

  return true;
};

export const advanceToNextSong = async (
  queueId: string,
  currentPosition: number,
): Promise<MusicQueue | null> =>
  prisma.$transaction(async (tx) => {
    const queue = await tx.musicQueue.findUnique({ where: { id: queueId } });
    if (!queue) return null;

    let nextSong;
    if (queue.shuffleEnabled) {
      nextSong = await tx.queueSong.findFirst({
        where: { queueId, position: { gt: currentPosition } },
        orderBy: [{ voteScore: 'desc' }, { position: 'asc' }],
        select: { id: true },
      });
    } else {
      nextSong = await tx.queueSong.findFirst({
        where: { queueId, position: { gt: currentPosition } },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
    }

    await tx.queueSong.deleteMany({
      where: { queueId, position: { lte: currentPosition } },
    });

    if (!nextSong) {
      return tx.musicQueue.update({
        where: { id: queueId },
        data: {
          currentQueueSongId: null,
          isPlaying: false,
          currentPositionMs: 0,
          playbackStartedAt: null,
        },
      });
    }

    return tx.musicQueue.update({
      where: { id: queueId },
      data: {
        currentQueueSongId: nextSong.id,
        currentPositionMs: 0,
        playbackStartedAt: new Date(),
        isPlaying: true,
      },
    });
  });

export type AddTrackResult = {
  song: QueueSongWithUser;
  /** True when this was the first song — callers should emit player:play */
  autoStarted: boolean;
};

export const addTrackToQueue = async (
  roomId: string,
  userId: string,
  trackData: {
    youtubeVideoId: string;
    title: string;
    thumbnail?: string | null;
    durationMs: number;
  },
): Promise<AddTrackResult> => {
  const musicQueue = await prisma.musicQueue.findUnique({ where: { roomId } });

  if (!musicQueue) {
    throw new ApiError(404, 'Music queue not found for the specified room.');
  }

  const lastSong = await prisma.queueSong.findFirst({
    where: { queueId: musicQueue.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const isFirstSong = !lastSong;
  const nextPosition = lastSong ? lastSong.position + 1 : 1;

  const song = await prisma.queueSong.create({
    data: {
      queueId: musicQueue.id,
      youtubeVideoId: trackData.youtubeVideoId,
      title: trackData.title,
      thumbnail: trackData.thumbnail ?? null,
      durationMs: trackData.durationMs,
      position: nextPosition,
      addedById: userId,
    },
    include: includeAddedBy,
  });

  if (isFirstSong) {
    const now = new Date();

    // 1. Postgres — source of truth
    await prisma.musicQueue.update({
      where: { id: musicQueue.id },
      data: {
        currentQueueSongId: song.id,
        currentPositionMs: 0,
        playbackStartedAt: now,
        isPlaying: true,
      },
    });

    // 2. Redis — sync cache so getQueueState returns live data immediately.
    // patchPlayerState handles the case where the key doesn't exist yet
    // (first song in a fresh room — Redis may not have been seeded).
    // We can't use seedPlayerState here because we don't have the full
    // MusicQueue row (we only have what we just updated). Use patch instead,
    // which merges on top of whatever is already in Redis.
    await patchPlayerState(roomId, {
      queueId: musicQueue.id,
      currentQueueSongId: song.id,
      currentPositionMs: 0,
      playbackStartedAt: now,
      isPlaying: true,
    });
  }

  return { song, autoStarted: isFirstSong };
};

export const findSongWithQueue = async (
  songId: string,
): Promise<(QueueSongWithUser & { queue: { id: string; roomId: string } }) | null> =>
  prisma.queueSong.findUnique({
    where: { id: songId },
    include: { queue: { select: { id: true, roomId: true } }, ...includeAddedBy },
  });

export type QueueState = Omit<MusicQueue, 'createdAt' | 'updatedAt'> & {
  songs: (QueueSongWithUser & { userVote?: 'up' | 'down' | null })[];
};

export const getQueueState = async (roomId: string, userId?: string): Promise<QueueState> => {
  // Use findMusicQueueByRoomId so we get the LIVE state from Redis.
  // This is critical because seek events are debounced in Postgres by 2s,
  // so querying Postgres directly here would return a stale position.
  const queue = await findMusicQueueByRoomId(roomId);

  if (!queue) { throw new ApiError(404, 'Queue not found for this room'); }

  const songsData = await prisma.queueSong.findMany({
    where: { queueId: queue.id },
    orderBy: { position: 'asc' },
    include: includeAddedBy,
  });

  let songs: (QueueSongWithUser & { userVote?: 'up' | 'down' | null })[] = songsData;

  if (userId) {
    const userVotes = await prisma.songVote.findMany({
      where: { queueSongId: { in: songs.map((s) => s.id) }, userId },
    });
    const voteMap = new Map(userVotes.map((v) => [v.queueSongId, v.voteType]));
    songs = songs.map((s) => ({ ...s, userVote: voteMap.get(s.id) || null }));
  } else {
    songs = songs.map((s) => ({ ...s, userVote: null }));
  }

  // We no longer dynamically sort on fetch.
  // The queue is strictly ordered by position.
  return { ...queue, songs };
};

export const removeTrackFromQueue = async (
  songId: string,
  requesterId: string,
): Promise<void> => {
  const song = await prisma.queueSong.findUnique({ where: { id: songId }, include: includeAddedBy });
  if (!song) { throw new ApiError(404, 'Song not found'); }
  if (song.addedById !== requesterId) { throw new ApiError(403, 'You can only remove songs you added'); }
  
  await prisma.queueSong.delete({ where: { id: songId } });
};

export const sortQueueByVotes = async (roomId: string): Promise<QueueState> => {
  const queue = await findMusicQueueByRoomId(roomId);
  if (!queue) { throw new ApiError(404, 'Queue not found for this room'); }

  const songsData = await prisma.queueSong.findMany({
    where: { queueId: queue.id },
    orderBy: { position: 'asc' },
  });

  const currentSongIndex = queue.currentQueueSongId
    ? songsData.findIndex((s) => s.id === queue.currentQueueSongId)
    : -1;

  let songsToUpdate = songsData;
  let startingPosition = 1;

  if (currentSongIndex !== -1 && queue?.currentQueueSongId) {
    // Only sort songs AFTER the currently playing song
    songsToUpdate = songsData.slice(currentSongIndex + 1);
    startingPosition = songsData[currentSongIndex]!.position + 1;
  }

  // Sort them by voteScore descending, then by old position ascending (stable sort)
  songsToUpdate.sort((a, b) => b.voteScore - a.voteScore || a.position - b.position);

  // Bulk update their positions in Postgres
  await prisma.$transaction(
    songsToUpdate.map((song, index) =>
      prisma.queueSong.update({
        where: { id: song.id },
        data: { position: startingPosition + index },
      })
    )
  );

  // Return the fresh state
  return getQueueState(roomId);
};

export const voteOnTrack = async (
  songId: string,
  userId: string,
  voteType: 'up' | 'down' | 'remove',
): Promise<QueueSongWithUser> => {
  const song = await prisma.queueSong.findUnique({ where: { id: songId }, include: includeAddedBy });
  if (!song) { throw new ApiError(404, 'Song not found'); }

  // Because the frontend uses Optimistic UI, backend latency is completely hidden.
  // We prioritize absolute consistency here. By doing an upsert followed by a COUNT,
  // we are 100% immune to race conditions (e.g., if a user spams the vote button 
  // and bypasses the frontend lock). The unique constraint on SongVote prevents 
  // duplicate rows, and the COUNT guarantees the QueueSong totals are perfectly accurate.
  if (voteType === 'remove') {
    return prisma.$transaction(async (tx) => {
      await tx.songVote.deleteMany({
        where: { queueSongId: songId, userId },
      });
  
      const [upVotes, downVotes] = await Promise.all([
        tx.songVote.count({ where: { queueSongId: songId, voteType: 'up' } }),
        tx.songVote.count({ where: { queueSongId: songId, voteType: 'down' } }),
      ]);
  
      return tx.queueSong.update({
        where: { id: songId },
        data: { upVotes, downVotes, voteScore: upVotes - downVotes },
        include: includeAddedBy,
      });
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.songVote.upsert({
      where: { queueSongId_userId: { queueSongId: songId, userId } },
      create: { queueSongId: songId, userId, voteType },
      update: { voteType },
    });

    const [upVotes, downVotes] = await Promise.all([
      tx.songVote.count({ where: { queueSongId: songId, voteType: 'up' } }),
      tx.songVote.count({ where: { queueSongId: songId, voteType: 'down' } }),
    ]);

    return tx.queueSong.update({
      where: { id: songId },
      data: { upVotes, downVotes, voteScore: upVotes - downVotes },
      include: includeAddedBy,
    });
  });
};

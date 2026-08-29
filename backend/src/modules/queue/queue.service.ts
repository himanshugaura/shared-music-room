import type { MusicQueue, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { logger } from '../../utils/logger.js';
import { getPlayerState, patchPlayerState, seedPlayerState } from '../../redis/player.js';
import { seekSyncQueue } from '../../jobs/queues.js';

export type QueueSongWithUser = Prisma.QueueSongGetPayload<{
  include: { addedBy: { select: { username: true; name: true; avatarUrl: true } } };
}>;

const includeAddedBy = {
  addedBy: { select: { username: true, name: true, avatarUrl: true } },
};

export const findMusicQueueByRoomId = async (
  roomId: string,
): Promise<Omit<MusicQueue, 'createdAt' | 'updatedAt'> | null> => {
  await syncQueueTimeline(roomId);

  const cached = await getPlayerState(roomId);

  if (cached) {
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

export const setQueuePlaying = async (roomId: string): Promise<boolean> => {
  const now = new Date();

  const exists = await getPlayerState(roomId);
  if (!exists) {
    const queue = await prisma.musicQueue.findUnique({ where: { roomId } });
    if (!queue) return false;
    await seedPlayerState(roomId, queue);
  }

  await patchPlayerState(roomId, { isPlaying: true, playbackStartedAt: now });

  prisma.musicQueue
    .update({ where: { roomId }, data: { isPlaying: true, playbackStartedAt: now } })
    .catch((err) => logger.error({ err, roomId }, 'Failed to sync play state to Postgres'));

  return true;
};

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

export const setQueueSeek = async (roomId: string, positionMs: number): Promise<boolean> => {
  const exists = await getPlayerState(roomId);
  if (!exists) {
    const queue = await prisma.musicQueue.findUnique({ where: { roomId } });
    if (!queue) return false;
    await seedPlayerState(roomId, queue);
  }

  await patchPlayerState(roomId, {
    currentPositionMs: positionMs,
    playbackStartedAt: new Date(),
  });

  seekSyncQueue
    .add(
      'sync-seek',
      { roomId },
      {
        jobId: `seek-sync:${roomId}`,
        delay: 2_000,
      },
    )
    .catch((err: unknown) => {
      logger.warn({ roomId, err }, 'seek-sync: failed to enqueue BullMQ job (non-critical)');
    });

  return true;
};

export const syncQueueTimeline = async (roomId: string): Promise<MusicQueue | null> => {
  const state = await getPlayerState(roomId);
  if (!state || !state.isPlaying || !state.playbackStartedAt || !state.currentQueueSongId) {
    return null;
  }

  const currentSongCheck = await prisma.queueSong.findUnique({
    where: { id: state.currentQueueSongId },
    select: { durationMs: true },
  });
  if (!currentSongCheck) return null;

  const GRACE_PERIOD_MS = 2000;

  const CLEAN_START_THRESHOLD_MS = 10000;

  const elapsedMs = Date.now() - state.playbackStartedAt.getTime() + state.currentPositionMs;
  if (elapsedMs < currentSongCheck.durationMs - GRACE_PERIOD_MS) return null;

  return prisma.$transaction(async (tx) => {
    const queue = await tx.musicQueue.findUnique({
      where: { roomId },
      include: { songs: true },
    });

    if (!queue || !queue.isPlaying || !queue.playbackStartedAt) return null;

    const latestRedisState = await getPlayerState(roomId);
    if (!latestRedisState || !latestRedisState.isPlaying || !latestRedisState.playbackStartedAt) {
      return null;
    }

    const txElapsedMs =
      Date.now() -
      latestRedisState.playbackStartedAt.getTime() +
      latestRedisState.currentPositionMs;
    const txCurrentSong = queue.songs.find((s) => s.id === latestRedisState.currentQueueSongId);
    if (!txCurrentSong || txElapsedMs < txCurrentSong.durationMs - GRACE_PERIOD_MS) return null;

    const sorted = [...queue.songs].sort((a, b) => {
      if (queue.shuffleEnabled && b.voteScore !== a.voteScore) {
        return b.voteScore - a.voteScore;
      }
      return a.position - b.position;
    });

    let remainingMs = txElapsedMs;
    let targetSongId: string | null = null;
    const songsToDelete: string[] = [];

    for (const song of sorted) {
      if (remainingMs < song.durationMs - GRACE_PERIOD_MS) {
        targetSongId = song.id;
        break;
      }
      remainingMs -= song.durationMs;
      songsToDelete.push(song.id);
    }

    if (songsToDelete.length === 0) return null;

    await tx.queueSong.deleteMany({ where: { id: { in: songsToDelete } } });

    if (targetSongId && remainingMs < CLEAN_START_THRESHOLD_MS) {
      remainingMs = 0;
    }

    const newStartedAt = targetSongId ? new Date(Date.now() - remainingMs) : null;

    const updatedQueue = await tx.musicQueue.update({
      where: { id: queue.id },
      data: {
        currentQueueSongId: targetSongId,
        isPlaying: !!targetSongId,
        currentPositionMs: 0,
        playbackStartedAt: newStartedAt,
      },
    });

    patchPlayerState(roomId, {
      isPlaying: updatedQueue.isPlaying,
      currentPositionMs: 0,
      playbackStartedAt: updatedQueue.playbackStartedAt,
      currentQueueSongId: updatedQueue.currentQueueSongId,
    }).catch(() => {});

    return updatedQueue;
  });
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

    await prisma.musicQueue.update({
      where: { id: musicQueue.id },
      data: {
        currentQueueSongId: song.id,
        currentPositionMs: 0,
        playbackStartedAt: now,
        isPlaying: true,
      },
    });

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
  const queue = await findMusicQueueByRoomId(roomId);

  if (!queue) {
    throw new ApiError(404, 'Queue not found for this room');
  }

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

  return { ...queue, songs };
};

export const removeTrackFromQueue = async (songId: string, requesterId: string): Promise<void> => {
  const song = await prisma.queueSong.findUnique({
    where: { id: songId },
    include: includeAddedBy,
  });
  if (!song) {
    throw new ApiError(404, 'Song not found');
  }
  if (song.addedById !== requesterId) {
    throw new ApiError(403, 'You can only remove songs you added');
  }

  await prisma.queueSong.delete({ where: { id: songId } });
};

export const sortQueueByVotes = async (roomId: string): Promise<QueueState> => {
  const queue = await findMusicQueueByRoomId(roomId);
  if (!queue) {
    throw new ApiError(404, 'Queue not found for this room');
  }

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
    songsToUpdate = songsData.slice(currentSongIndex + 1);
    startingPosition = songsData[currentSongIndex]!.position + 1;
  }

  songsToUpdate.sort((a, b) => b.voteScore - a.voteScore || a.position - b.position);

  await prisma.$transaction(
    songsToUpdate.map((song, index) =>
      prisma.queueSong.update({
        where: { id: song.id },
        data: { position: startingPosition + index },
      }),
    ),
  );

  return getQueueState(roomId);
};

export const voteOnTrack = async (
  songId: string,
  userId: string,
  voteType: 'up' | 'down' | 'remove',
): Promise<QueueSongWithUser> => {
  const song = await prisma.queueSong.findUnique({
    where: { id: songId },
    include: includeAddedBy,
  });
  if (!song) {
    throw new ApiError(404, 'Song not found');
  }

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

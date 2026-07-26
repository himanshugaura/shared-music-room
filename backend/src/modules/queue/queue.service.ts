import type { MusicQueue } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueueSongWithUser = Prisma.QueueSongGetPayload<{
  include: { addedBy: { select: { username: true; name: true; avatarUrl: true } } };
}>;

// ─── DB layer (inlined from musicQueue.repository + queueSong.repository) ────

const includeAddedBy = {
  addedBy: { select: { username: true, name: true, avatarUrl: true } },
};

// MusicQueue DB helpers

export const findMusicQueueByRoomId = async (roomId: string): Promise<MusicQueue | null> =>
  prisma.musicQueue.findUnique({ where: { roomId } });

export const setQueuePlaying = async (queueId: string): Promise<MusicQueue> =>
  prisma.musicQueue.update({
    where: { id: queueId },
    data: { isPlaying: true, playbackStartedAt: new Date() },
  });

export const setQueuePaused = async (
  queueId: string,
  currentPositionMs: number,
): Promise<MusicQueue> =>
  prisma.musicQueue.update({
    where: { id: queueId },
    data: { isPlaying: false, currentPositionMs, playbackStartedAt: null },
  });

export const setQueueSeek = async (queueId: string, positionMs: number): Promise<MusicQueue> =>
  prisma.musicQueue.update({
    where: { id: queueId },
    data: { currentPositionMs: positionMs, playbackStartedAt: new Date() },
  });

const updateQueueSettingsDb = async (
  queueId: string,
  settings: { shuffleEnabled?: boolean },
): Promise<MusicQueue> =>
  prisma.musicQueue.update({ where: { id: queueId }, data: settings });

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

// QueueSong DB helpers

export const addTrackToQueue = async (
  roomId: string,
  trackData: {
    youtubeVideoId: string;
    title: string;
    thumbnail?: string | null;
    durationMs: number;
    addedById: string;
  },
): Promise<QueueSongWithUser> => {
  const musicQueue = await findMusicQueueByRoomId(roomId);

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

  const newSong = await prisma.queueSong.create({
    data: {
      queueId: musicQueue.id,
      youtubeVideoId: trackData.youtubeVideoId,
      title: trackData.title,
      thumbnail: trackData.thumbnail ?? null,
      durationMs: trackData.durationMs,
      position: nextPosition,
      addedById: trackData.addedById,
    },
    include: includeAddedBy,
  });

  if (isFirstSong) {
    await prisma.musicQueue.update({
      where: { id: musicQueue.id },
      data: {
        currentQueueSongId: newSong.id,
        currentPositionMs: 0,
        playbackStartedAt: new Date(),
        isPlaying: true,
      },
    });
  }

  return newSong;
};

const findSongsByQueueId = async (queueId: string): Promise<QueueSongWithUser[]> =>
  prisma.queueSong.findMany({
    where: { queueId },
    orderBy: { position: 'asc' },
    include: includeAddedBy,
  });

export const findSongById = async (songId: string): Promise<QueueSongWithUser | null> =>
  prisma.queueSong.findUnique({ where: { id: songId }, include: includeAddedBy });

const removeTrackFromQueue = async (songId: string): Promise<QueueSongWithUser> =>
  prisma.queueSong.delete({ where: { id: songId }, include: includeAddedBy });

export const findSongWithQueue = async (
  songId: string,
): Promise<(QueueSongWithUser & { queue: { id: string; roomId: string } }) | null> =>
  prisma.queueSong.findUnique({
    where: { id: songId },
    include: { queue: { select: { id: true, roomId: true } }, ...includeAddedBy },
  });

const upsertVote = async (
  queueSongId: string,
  userId: string,
  voteType: 'up' | 'down',
): Promise<QueueSongWithUser> =>
  prisma.$transaction(async (tx) => {
    await tx.songVote.upsert({
      where: { queueSongId_userId: { queueSongId, userId } },
      create: { queueSongId, userId, voteType },
      update: { voteType },
    });

    const [upVotes, downVotes] = await Promise.all([
      tx.songVote.count({ where: { queueSongId, voteType: 'up' } }),
      tx.songVote.count({ where: { queueSongId, voteType: 'down' } }),
    ]);

    return tx.queueSong.update({
      where: { id: queueSongId },
      data: { upVotes, downVotes, voteScore: upVotes - downVotes },
      include: includeAddedBy,
    });
  });

const deleteVote = async (
  queueSongId: string,
  userId: string,
): Promise<QueueSongWithUser> =>
  prisma.$transaction(async (tx) => {
    await tx.songVote.delete({
      where: { queueSongId_userId: { queueSongId, userId } },
    });

    const [upVotes, downVotes] = await Promise.all([
      tx.songVote.count({ where: { queueSongId, voteType: 'up' } }),
      tx.songVote.count({ where: { queueSongId, voteType: 'down' } }),
    ]);

    return tx.queueSong.update({
      where: { id: queueSongId },
      data: { upVotes, downVotes, voteScore: upVotes - downVotes },
      include: includeAddedBy,
    });
  });

// ─── Business logic ──────────────────────────────────────────────────────────

export type QueueState = MusicQueue & {
  songs: (QueueSongWithUser & { userVote?: 'up' | 'down' | null })[];
};

export const getQueueState = async (roomId: string, userId?: string): Promise<QueueState> => {
  const queue = await findMusicQueueByRoomId(roomId);

  if (!queue) { throw new ApiError(404, 'Queue not found for this room'); }

  let songsData = await findSongsByQueueId(queue.id);
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

  if (queue.shuffleEnabled) {
    const currentSongIndex = queue.currentQueueSongId
      ? songs.findIndex((s) => s.id === queue.currentQueueSongId)
      : -1;

    if (currentSongIndex !== -1) {
      const historyAndCurrent = songs.slice(0, currentSongIndex + 1);
      const remaining = songs.slice(currentSongIndex + 1);
      remaining.sort((a, b) => b.voteScore - a.voteScore || a.position - b.position);
      songs = [...historyAndCurrent, ...remaining];
    } else {
      songs.sort((a, b) => b.voteScore - a.voteScore || a.position - b.position);
    }
  }

  return { ...queue, songs };
};

export const addTrackToQueueService = async (
  roomId: string,
  userId: string,
  track: {
    youtubeVideoId: string;
    title: string;
    thumbnail?: string | null;
    durationMs: number;
  },
): Promise<QueueSongWithUser> =>
  addTrackToQueue(roomId, { ...track, addedById: userId });

export const removeTrackFromQueueService = async (
  songId: string,
  requesterId: string,
): Promise<void> => {
  const song = await findSongById(songId);
  if (!song) { throw new ApiError(404, 'Song not found'); }
  if (song.addedById !== requesterId) { throw new ApiError(403, 'You can only remove songs you added'); }
  await removeTrackFromQueue(songId);
};

export const updateQueueSettingsService = async (
  roomId: string,
  settings: { shuffleEnabled?: boolean },
): Promise<MusicQueue> => {
  const queue = await findMusicQueueByRoomId(roomId);
  if (!queue) { throw new ApiError(404, 'Queue not found for this room'); }
  return updateQueueSettingsDb(queue.id, settings);
};

export const voteOnTrack = async (
  songId: string,
  userId: string,
  voteType: 'up' | 'down' | 'remove',
): Promise<QueueSongWithUser> => {
  const song = await findSongById(songId);
  if (!song) { throw new ApiError(404, 'Song not found'); }

  if (voteType === 'remove') {
    return deleteVote(song.id, userId);
  }

  return upsertVote(song.id, userId, voteType);
};

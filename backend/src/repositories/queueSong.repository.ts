import type { QueueSong } from '@prisma/client';
import { findMusicQueueByRoomId } from './musicQueue.repository.js';
import { ApiError } from '../utils/apiError.js';
import { prisma } from '../config/prisma.js';

export const addTrackToQueue = async (
  roomId: string,
  trackData: {
    youtubeVideoId: string;
    title: string;
    thumbnail?: string | null;
    durationMs: number;
    addedById: string;
  },
): Promise<QueueSong> => {
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

export const findSongsByQueueId = async (queueId: string): Promise<QueueSong[]> => {
  return prisma.queueSong.findMany({
    where: { queueId },
    orderBy: { position: 'asc' },
  });
};

export const findSongById = async (songId: string): Promise<QueueSong | null> => {
  return prisma.queueSong.findUnique({ where: { id: songId } });
};

export const removeTrackFromQueue = async (songId: string): Promise<QueueSong> => {
  return prisma.queueSong.delete({ where: { id: songId } });
};

export const findSongWithQueue = async (
  songId: string,
): Promise<(QueueSong & { queue: { id: string; roomId: string } }) | null> => {
  return prisma.queueSong.findUnique({
    where: { id: songId },
    include: { queue: { select: { id: true, roomId: true } } },
  });
};

export const upsertVote = async (
  queueSongId: string,
  userId: string,
  voteType: 'up' | 'down',
): Promise<QueueSong> => {
  return prisma.$transaction(async (tx) => {
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
    });
  });
};

export const deleteVote = async (
  queueSongId: string,
  userId: string,
): Promise<QueueSong> => {
  return prisma.$transaction(async (tx) => {
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
    });
  });
};


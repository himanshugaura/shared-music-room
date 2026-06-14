import type { MusicQueue } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const createMusicQueueRecord = async (
  roomId: string,
  shuffleEnabled: boolean,
): Promise<MusicQueue> => {
  return prisma.musicQueue.create({
    data: { roomId, shuffleEnabled },
  });
};

export const findMusicQueueByRoomId = async (
  roomId: string,
): Promise<MusicQueue | null> => {
  return prisma.musicQueue.findUnique({
    where: { roomId },
  });
};

export const setQueuePlaying = async (queueId: string): Promise<MusicQueue> => {
  return prisma.musicQueue.update({
    where: { id: queueId },
    data: {
      isPlaying: true,
      playbackStartedAt: new Date(),
    },
  });
};

export const setQueuePaused = async (
  queueId: string,
  currentPositionMs: number,
): Promise<MusicQueue> => {
  return prisma.musicQueue.update({
    where: { id: queueId },
    data: {
      isPlaying: false,
      currentPositionMs,
      playbackStartedAt: null,
    },
  });
};

export const setQueueSeek = async (
  queueId: string,
  positionMs: number,
): Promise<MusicQueue> => {
  return prisma.musicQueue.update({
    where: { id: queueId },
    data: {
      currentPositionMs: positionMs,
      playbackStartedAt: new Date(),
    },
  });
};

export const updateQueueSettings = async (
  queueId: string,
  settings: { shuffleEnabled?: boolean },
): Promise<MusicQueue> => {
  return prisma.musicQueue.update({
    where: { id: queueId },
    data: settings,
  });
};

export const advanceToNextSong = async (
  queueId: string,
  currentPosition: number,
): Promise<MusicQueue | null> => {
  return prisma.$transaction(async (tx) => {
    const nextSong = await tx.queueSong.findFirst({
      where: { queueId, position: { gt: currentPosition } },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

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
};



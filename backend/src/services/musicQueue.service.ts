import type { MusicQueue } from '@prisma/client';
import { type QueueSongWithUser } from '../repositories/queueSong.repository.js';
import {
  findMusicQueueByRoomId,
  updateQueueSettings,
} from '../repositories/musicQueue.repository.js';
import {
  addTrackToQueue,
  deleteVote,
  findSongById,
  findSongsByQueueId,
  removeTrackFromQueue,
  upsertVote,
} from '../repositories/queueSong.repository.js';

import { ApiError } from '../utils/apiError.js';

import { prisma } from '../config/prisma.js';

export type QueueState = MusicQueue & { songs: (QueueSongWithUser & { userVote?: 'up' | 'down' | null })[] };

export const getQueueState = async (roomId: string, userId?: string): Promise<QueueState> => {
  const queue = await findMusicQueueByRoomId(roomId);

  if (!queue) {throw new ApiError(404, 'Queue not found for this room');}

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
): Promise<QueueSongWithUser> => {
  return addTrackToQueue(roomId, { ...track, addedById: userId });
};

export const removeTrackFromQueueService = async (
  songId: string,
  requesterId: string,
): Promise<void> => {
  const song = await findSongById(songId);

  if (!song) {throw new ApiError(404, 'Song not found');}
  if (song.addedById !== requesterId) {throw new ApiError(403, 'You can only remove songs you added');}

  await removeTrackFromQueue(songId);
};

export const updateQueueSettingsService = async (
  roomId: string,
  settings: { shuffleEnabled?: boolean },
): Promise<MusicQueue> => {
  const queue = await findMusicQueueByRoomId(roomId);

  if (!queue) {throw new ApiError(404, 'Queue not found for this room');}

  return updateQueueSettings(queue.id, settings);
};

export const voteOnTrack = async (
  songId: string,
  userId: string,
  voteType: 'up' | 'down' | 'remove',
): Promise<QueueSongWithUser> => {
  const song = await findSongById(songId);

  if (!song) {throw new ApiError(404, 'Song not found');}

  if (voteType === 'remove') {
    return deleteVote(song.id, userId);
  }

  return upsertVote(song.id, userId, voteType);
};


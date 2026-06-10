import type { MusicQueue, QueueSong } from '@prisma/client';
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

export type QueueState = MusicQueue & { songs: QueueSong[] };

export const getQueueState = async (roomId: string): Promise<QueueState> => {
  const queue = await findMusicQueueByRoomId(roomId);

  if (!queue) {throw new ApiError(404, 'Queue not found for this room');}

  const songs = await findSongsByQueueId(queue.id);

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
): Promise<QueueSong> => {
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
): Promise<QueueSong> => {
  const song = await findSongById(songId);

  if (!song) {throw new ApiError(404, 'Song not found');}

  if (voteType === 'remove') {
    return deleteVote(song.id, userId);
  }

  return upsertVote(song.id, userId, voteType);
};


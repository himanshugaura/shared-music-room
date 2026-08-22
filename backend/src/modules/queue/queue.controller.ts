import type { Request, Response } from 'express';

import {
  addTrackToQueue,
  findSongWithQueue,
  getQueueState,
  removeTrackFromQueue,
  sortQueueByVotes,
  voteOnTrack,
} from './queue.service.js';
import { getIO } from '../../socket/index.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import type { AddTrackBody, UpdateQueueSettingsBody, VoteBody } from './queue.validations.js';

export const getQueue = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params as { roomId: string };
  const userId = req.user?.id;

  const queue = await getQueueState(roomId, userId);

  return new ApiResponse(200, queue, 'Queue fetched successfully').send(res);
});

export const addTrack = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params as { roomId: string };
  const userId = req.user!.id;
  const { youtubeVideoId, title, thumbnail, durationMs } = req.body as AddTrackBody;

  const { song, autoStarted } = await addTrackToQueue(roomId, userId, {
    youtubeVideoId,
    title,
    thumbnail: thumbnail ?? null,
    durationMs,
  });

  getIO().to(roomId).emit('queue:song_added', { roomId, song });

  if (autoStarted) {
    getIO().to(roomId).emit('player:play', { roomId, at: Date.now() });
  }

  return new ApiResponse(201, song, 'Track added to queue').send(res);
});

export const removeTrack = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, songId } = req.params as { roomId: string; songId: string };
  const userId = req.user!.id;

  await removeTrackFromQueue(songId, userId);

  getIO().to(roomId).emit('queue:song_deleted', { songId });

  return new ApiResponse(200, null, 'Track removed from queue').send(res);
});

export const sortByVotes = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params as { roomId: string };

  const queue = await sortQueueByVotes(roomId);
  
  getIO().to(roomId).emit('queueUpdated', { roomId, queue });

  return new ApiResponse(200, queue, 'Queue sorted by votes').send(res);
});

export const voteTrack = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, songId } = req.params as { roomId: string; songId: string };
  const userId = req.user!.id;
  const { voteType } = req.body as VoteBody;

  const song = await voteOnTrack(songId, userId, voteType);
  const queueState = await getQueueState(roomId);

  if (queueState.shuffleEnabled) {
    getIO().to(roomId).emit('queueUpdated', { queue: queueState });
  } else {
    getIO().to(roomId).emit('queue:song_voted', { song });
  }

  return new ApiResponse(200, song, 'Vote recorded').send(res);
});

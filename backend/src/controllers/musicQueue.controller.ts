import type { Request, Response } from 'express';
import {
  addTrackToQueueService,
  getQueueState,
  removeTrackFromQueueService,
  updateQueueSettingsService,
  voteOnTrack,
} from '../services/musicQueue.service.js';
import { getIO } from '../socket/index.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AddTrackBody, UpdateQueueSettingsBody, VoteBody } from '../validations/queue.validations.js';


export const getQueue = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params as { roomId: string };

  const queue = await getQueueState(roomId);

  return new ApiResponse(200, queue, 'Queue fetched successfully').send(res);
});

export const addTrack = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params as { roomId: string };
  const userId = req.user!.id;
  const { youtubeVideoId, title, thumbnail, durationMs } = req.body as AddTrackBody;

  const song = await addTrackToQueueService(roomId, userId, {
    youtubeVideoId,
    title,
    thumbnail: thumbnail ?? null,
    durationMs,
  });

  getIO().to(roomId).emit('queue:song_added', { roomId, song });

  return new ApiResponse(201, song, 'Track added to queue').send(res);
});


export const removeTrack = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params as { songId: string };
  const userId = req.user!.id;

  await removeTrackFromQueueService(songId, userId);

  return new ApiResponse(200, null, 'Track removed from queue').send(res);
});

export const updateQueueSettings = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params as { roomId: string };
  const body = req.body as UpdateQueueSettingsBody;

  const queue = await updateQueueSettingsService(roomId, body);

  return new ApiResponse(200, queue, 'Queue settings updated').send(res);
});

export const voteTrack = asyncHandler(async (req: Request, res: Response) => {
  const { songId } = req.params as { songId: string };
  const userId = req.user!.id;
  const { voteType } = req.body as VoteBody;

  const song = await voteOnTrack(songId, userId, voteType);

  return new ApiResponse(200, song, 'Vote recorded').send(res);
});


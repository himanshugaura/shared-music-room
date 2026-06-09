import type { Request, Response } from 'express';

import { joinRoomAsMember } from '../repositories/user.repository.js';
import {
  checkUsernameAvailability,
  getJoinedRooms,
  getOwnedRooms,
  getUserProfile,
  updateUserProfile,
} from '../services/user.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  const user = await getUserProfile(userId!);

  return new ApiResponse(200, user, 'User profile fetched successfully').send(res);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  const { name, username } = req.body as { name?: string; username?: string };

  const input: import('../services/user.service.js').UpdateProfileInput = {};
  if (name !== undefined) {input.name = name;}
  if (username !== undefined) {input.username = username;}
  if (req.file !== undefined) {input.file = req.file;}

  const user = await updateUserProfile(userId!, input);

  return new ApiResponse(200, user, 'User profile updated successfully').send(res);
});

export const checkUsername = asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.body as { username: string };

  await checkUsernameAvailability(username);

  return new ApiResponse(200, null, 'Username is available').send(res);
});

export const getUserOwnedRooms = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  const rooms = await getOwnedRooms(userId!);

  return new ApiResponse(200, rooms, 'Owned rooms fetched successfully').send(res);
});

export const getUserJoinedRooms = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  const rooms = await getJoinedRooms(userId!);

  return new ApiResponse(200, rooms, 'Joined rooms fetched successfully').send(res);
});

export const joinRoom = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { roomId } = req.params as { roomId: string };

    joinRoomAsMember(roomId, userId!);

  return new ApiResponse(200, null, 'Joined room successfully').send(res);
});


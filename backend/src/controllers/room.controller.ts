import type { Request, Response } from 'express';

import {
  createRoomService,
  deleteRoomService,
  getRoomDetailsService,
  listPublicRoomsService,
} from '../services/room.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { CreateRoomBody } from '../validations/room.validations.js';

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  const { name, description, visibility, shuffleEnabled } = req.body as CreateRoomBody;

  const room = await createRoomService({
    name,
    description: description ?? null,
    visibility,
    userId: userId!,
    ...(shuffleEnabled !== undefined && { shuffleEnabled }),
  });

  return new ApiResponse(201, room, 'Room created successfully').send(res);
});

export const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params as { roomId: string };
  const userId = req.user!.id;

  await deleteRoomService(roomId, userId);

  return new ApiResponse(200, null, 'Room deleted successfully').send(res);
});

export const listPublicRooms = asyncHandler(async (_req: Request, res: Response) => {
  const rooms = await listPublicRoomsService();

  return new ApiResponse(200, rooms, "Public rooms fetched successfully").send(res);
});

export const getRoomDetails = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params as { roomId: string };

  const room = await getRoomDetailsService(roomId);

  return new ApiResponse(200, room, "Room details fetched successfully").send(res);
});
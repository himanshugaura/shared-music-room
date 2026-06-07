import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import {
  createRoomService,
  deleteRoomService,
  listPublicRoomsService,
  getRoomDetailsService,
} from "../services/room.services.js";
import type { CreateRoomBody } from "../validations/room.validations.js";
import type { Visibility } from "@prisma/client";

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) throw new ApiError(401, "Unauthorized");

  const { name, description, visibility } = req.body as CreateRoomBody;

  const room = await createRoomService({
    name,
    description: description ?? null,
    visibility: visibility as Visibility,
    userId,
  });

  return new ApiResponse(201, room, "Room created successfully").send(res);
});

export const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params as { roomId: string };

  await deleteRoomService(roomId);

  return new ApiResponse(200, null, "Room deleted successfully").send(res);
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
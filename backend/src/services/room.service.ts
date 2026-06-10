import type { Room } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { customAlphabet } from "nanoid";

import {
  createRoomRecord,
  deleteRoomById,
  findPublicRooms,
  findRoomById,
  findRoomOwnerById,
} from '../repositories/room.repository.js';
import { createMusicQueueRecord } from "../repositories/musicQueue.repository.js";
import type { CreateRoomInput, RoomSummary } from "../types/room.types.js";
import { ApiError } from "../utils/apiError.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ROOM_CODE_LENGTH = 6;
const MAX_ROOM_CODE_ATTEMPTS = 5;

const generateRoomCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

export const createRoomService = async (input: CreateRoomInput): Promise<Room> => {
  const { name, description, visibility, userId, shuffleEnabled } = input;

  let room: Room | undefined;

  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt++) {
    try {
      room = await createRoomRecord({
        name,
        description: description ?? null,
        visibility,
        roomCode: generateRoomCode(),
        owner: { connect: { id: userId } },
      });
      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  if (!room) {
    throw new ApiError(500, "Failed to generate a unique room code — please try again");
  }

  await createMusicQueueRecord(room.id , shuffleEnabled ?? false);

  return room;
};

export const deleteRoomService = async (roomId: string, requesterId: string): Promise<Room> => {
  const room = await findRoomOwnerById(roomId);

  if (!room) {throw new ApiError(404, 'Room not found');}
  if (room.ownerId !== requesterId) {throw new ApiError(403, 'Only the room owner can delete this room');}

  return deleteRoomById(roomId);
};

export const listPublicRoomsService = async (): Promise<RoomSummary[]> => {
  return findPublicRooms();
};

export const getRoomDetailsService = async (roomId: string): Promise<Room | null> => {
  return findRoomById(roomId);
};
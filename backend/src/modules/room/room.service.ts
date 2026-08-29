import type { Prisma, Room } from '@prisma/client';
import { Prisma as PrismaClient } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { prisma } from '../../config/prisma.js';
import type { CreateRoomInput, RoomSummary } from '../../types/room.types.js';
import { ApiError } from '../../utils/apiError.js';

const ROOM_SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  roomCode: true,
  visibility: true,
  createdAt: true,
} as const satisfies Prisma.RoomSelect;

export const findRoomExistsById = async (roomId: string): Promise<Pick<Room, 'id'> | null> =>
  prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });

export const findRoomOwnerById = async (
  roomId: string,
): Promise<Pick<Room, 'id' | 'ownerId'> | null> =>
  prisma.room.findUnique({ where: { id: roomId }, select: { id: true, ownerId: true } });

const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ROOM_CODE_LENGTH = 6;
const MAX_ROOM_CODE_ATTEMPTS = 5;

const generateRoomCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

export const createRoomService = async (input: CreateRoomInput): Promise<Room> => {
  const { name, description, visibility, userId, shuffleEnabled } = input;

  let room: Room | undefined;

  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt++) {
    try {
      room = await prisma.room.create({
        data: {
          name,
          description: description ?? null,
          visibility,
          roomCode: generateRoomCode(),
          owner: { connect: { id: userId } },
        },
      });
      break;
    } catch (error) {
      if (error instanceof PrismaClient.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue;
      }
      throw error;
    }
  }

  if (!room) {
    throw new ApiError(500, 'Failed to generate a unique room code — please try again');
  }

  await prisma.musicQueue.create({
    data: {
      roomId: room.id,
      shuffleEnabled: shuffleEnabled ?? false,
    },
  });

  return room;
};

export const deleteRoomService = async (roomId: string, requesterId: string): Promise<Room> => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, ownerId: true },
  });

  if (!room) {
    throw new ApiError(404, 'Room not found');
  }
  if (room.ownerId !== requesterId) {
    throw new ApiError(403, 'Only the room owner can delete this room');
  }

  return prisma.room.delete({ where: { id: roomId } });
};

export const listPublicRoomsService = async (): Promise<RoomSummary[]> => {
  return prisma.room.findMany({
    where: { visibility: 'public' },
    select: ROOM_SUMMARY_SELECT,
    orderBy: { createdAt: 'desc' },
  });
};

export const getRoomDetailsService = async (roomId: string): Promise<Room | null> => {
  return prisma.room.findUnique({
    where: { id: roomId },
    include: {
      owner: { select: { id: true, username: true, name: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, username: true, name: true, avatarUrl: true } },
        },
      },
    },
  });
};

import type { MusicQueue, Prisma, Room } from "@prisma/client";

import { prisma } from "../config/prisma.js";
import type { RoomSummary } from "../types/room.types.js";

const ROOM_SUMMARY_SELECT = {
  id: true,
  name: true,
  roomCode: true,
  visibility: true,
  createdAt: true,
} as const satisfies Prisma.RoomSelect;

export const createRoomRecord = async (
  data: Prisma.RoomCreateInput,
): Promise<Room> => {
  return prisma.room.create({ data });
};

export const deleteRoomById = async (roomId: string): Promise<Room> => {
  return prisma.room.delete({
    where: { id: roomId },
  });
};

export const findPublicRooms = async (): Promise<RoomSummary[]> => {
  return prisma.room.findMany({
    where: {
      visibility: "public",
    },
    select: ROOM_SUMMARY_SELECT,
    orderBy: { createdAt: "desc" },
  });
};

export const findRoomById = async (roomId: string): Promise<Room | null> => {
  return prisma.room.findUnique({
    where: { id: roomId },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });
};

export const findRoomByCode = async (roomCode: string): Promise<Pick<Room, 'id'> | null> => {
  return prisma.room.findUnique({
    where: { roomCode },
    select: { id: true },
  });
};

export const findRoomExistsById = async (roomId: string): Promise<Pick<Room, 'id'> | null> => {
  return prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true },
  });
};

export const findRoomOwnerById = async (
  roomId: string,
): Promise<Pick<Room, 'id' | 'ownerId'> | null> => {
  return prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, ownerId: true },
  });
};
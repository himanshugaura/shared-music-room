import { prisma } from "../config/prisma.js";
import type { RoomSummary } from "../types/room.types.js";
import type { Prisma, Room } from "@prisma/client";

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

export const createMusicQueueRecord = async (roomId: string): Promise<void> => {
  await prisma.musicQueue.create({
    data: { roomId },
  });
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
      admins: {
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
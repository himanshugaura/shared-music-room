import type { Prisma, User } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import type { AuthUser } from '../types/auth.types.js';
import type { RoomSummary } from '../types/room.types.js';

const USER_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  avatarUrl: true,
  isVerified: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

const ROOM_SUMMARY_SELECT = {
  id: true,
  name: true,
  roomCode: true,
  visibility: true,
  createdAt: true,
} as const satisfies Prisma.RoomSelect;

export const findUserProfileById = async (
  id: string,
): Promise<(AuthUser & { username: string | null; createdAt: Date; isVerified: boolean }) | null> => {
  return prisma.user.findUnique({
    where: { id },
    select: USER_PROFILE_SELECT,
  });
};

export const findUserByUsername = async (
  username: string,
): Promise<Pick<User, 'id'> | null> => {
  return prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
};

export const findOwnedRooms = async (userId: string): Promise<RoomSummary[]> => {
  return prisma.room.findMany({
    where: { ownerId: userId },
    select: ROOM_SUMMARY_SELECT,
    orderBy: { createdAt: 'desc' },
  });
};

export const findMemberRooms = async (userId: string): Promise<RoomSummary[]> => {
  return prisma.room.findMany({
    where: { members: { some: { userId } } },
    select: ROOM_SUMMARY_SELECT,
    orderBy: { createdAt: 'desc' },
  });
};

export const updateUserProfile = async (
  id: string,
  data: Prisma.UserUpdateInput,
): Promise<User> => {
  return prisma.user.update({ where: { id }, data });
};


export const joinRoomAsMember = async (roomId: string, userId: string): Promise<void> => {
  await prisma.roomMember.create({
      data: {
        roomId,
        userId,
      },
    });
};

export const findRoomMember = async (
  roomId: string,
  userId: string,
): Promise<{ roomId: string; userId: string } | null> => {
  return prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { roomId: true, userId: true },
  });
};
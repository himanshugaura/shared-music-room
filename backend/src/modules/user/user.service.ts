import type { Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma.js';
import type { AuthUser } from '../../types/auth.types.js';
import type { JoinedRoomsResponse, RoomSummary } from '../../types/room.types.js';
import { ApiError } from '../../utils/apiError.js';
import { deleteFromCloudinary, uploadAvatar } from '../../utils/cloudinary.js';

const USER_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

const ROOM_SUMMARY_SELECT = {
  id: true,
  name: true,
  roomCode: true,
  visibility: true,
  createdAt: true,
} as const satisfies Prisma.RoomSelect;

export type UserProfile = AuthUser & { username: string | null; createdAt: Date };

export const getUserProfileById = async (
  id: string,
): Promise<UserProfile | null> =>
  prisma.user.findUnique({ where: { id }, select: USER_PROFILE_SELECT });

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_PROFILE_SELECT,
  });
  if (!user) { throw new ApiError(404, 'User not found'); }
  return user;
};

export const checkUsernameAvailability = async (username: string): Promise<void> => {
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing) { throw new ApiError(409, 'Username is already taken'); }
};

export interface UpdateProfileInput {
  name?: string;
  username?: string;
  file?: Express.Multer.File | undefined;
}

export const updateUserProfile = async (
  userId: string,
  { name, username, file }: UpdateProfileInput,
): Promise<UserProfile> => {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_PROFILE_SELECT,
  });
  
  if (!current) { throw new ApiError(404, 'User not found'); }

  let avatarUrl: string | null = current.avatarUrl;
  let avatarPublicId: string | null = null;

  if (file) {
    const uploaded = await uploadAvatar(file.buffer);
    avatarUrl = uploaded.secureUrl;
    avatarPublicId = uploaded.publicId;

    const fullUser = await prisma.user.findUnique({ where: { id: userId } });
    const oldPublicId = fullUser?.avatarPublicId ?? null;
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined && { name }),
      ...(username !== undefined && { username }),
      avatarUrl,
      ...(avatarPublicId !== null && { avatarPublicId }),
    },
  });

  return getUserProfile(userId);
};

export const getOwnedRooms = async (userId: string): Promise<RoomSummary[]> => {
  return prisma.room.findMany({
    where: { ownerId: userId },
    select: ROOM_SUMMARY_SELECT,
    orderBy: { createdAt: 'desc' },
  });
};

export const getJoinedRooms = async (userId: string): Promise<JoinedRoomsResponse> => {
  const member = await prisma.room.findMany({
    where: { members: { some: { userId } } },
    select: ROOM_SUMMARY_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  
  return { member };
};

export const joinRoom = async (roomId: string, userId: string): Promise<void> => {
  const existing = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { roomId: true, userId: true },
  });
  
  if (existing) { throw new ApiError(409, 'You are already a member of this room'); }
  
  await prisma.roomMember.create({ data: { roomId, userId } });
};

export const joinRoomByCode = async (roomCode: string, userId: string): Promise<void> => {
  const room = await prisma.room.findUnique({
    where: { roomCode },
    select: { id: true },
  });
  
  if (!room) { throw new ApiError(404, 'Room not found'); }

  const existing = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId } },
    select: { roomId: true, userId: true },
  });
  
  if (existing) { throw new ApiError(409, 'You are already a member of this room'); }

  await prisma.roomMember.create({ data: { roomId: room.id, userId } });
};

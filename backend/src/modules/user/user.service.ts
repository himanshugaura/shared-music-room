import type { Prisma, User } from '@prisma/client';

import { prisma } from '../../config/prisma.js';
import type { AuthUser } from '../../types/auth.types.js';
import type { JoinedRoomsResponse, RoomSummary } from '../../types/room.types.js';
import { ApiError } from '../../utils/apiError.js';
import { deleteFromCloudinary, uploadAvatar } from '../../utils/cloudinary.js';

// ─── DB layer (inlined) ──────────────────────────────────────────────────────

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

export const findUserProfileById = async (
  id: string,
): Promise<(AuthUser & { username: string | null; createdAt: Date }) | null> =>
  prisma.user.findUnique({ where: { id }, select: USER_PROFILE_SELECT });

const findUserById = async (id: string): Promise<User | null> =>
  prisma.user.findUnique({ where: { id } });

const findUserByUsernameCheck = async (username: string): Promise<Pick<User, 'id'> | null> =>
  prisma.user.findUnique({ where: { username }, select: { id: true } });

const findOwnedRooms = async (userId: string): Promise<RoomSummary[]> =>
  prisma.room.findMany({
    where: { ownerId: userId },
    select: ROOM_SUMMARY_SELECT,
    orderBy: { createdAt: 'desc' },
  });

const findMemberRooms = async (userId: string): Promise<RoomSummary[]> =>
  prisma.room.findMany({
    where: { members: { some: { userId } } },
    select: ROOM_SUMMARY_SELECT,
    orderBy: { createdAt: 'desc' },
  });

const updateUserProfileDb = async (id: string, data: Prisma.UserUpdateInput): Promise<User> =>
  prisma.user.update({ where: { id }, data });

const joinRoomAsMember = async (roomId: string, userId: string): Promise<void> => {
  await prisma.roomMember.create({ data: { roomId, userId } });
};

const findRoomMember = async (
  roomId: string,
  userId: string,
): Promise<{ roomId: string; userId: string } | null> =>
  prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { roomId: true, userId: true },
  });

const findRoomByCode = async (roomCode: string): Promise<Pick<{ id: string }, 'id'> | null> =>
  prisma.room.findUnique({ where: { roomCode }, select: { id: true } });

// ─── Business logic ──────────────────────────────────────────────────────────

export type UserProfile = AuthUser & { username: string | null; createdAt: Date };

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const user = await findUserProfileById(userId);
  if (!user) { throw new ApiError(404, 'User not found'); }
  return user;
};

export const checkUsernameAvailability = async (username: string): Promise<void> => {
  const existing = await findUserByUsernameCheck(username);
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
  const current = await findUserProfileById(userId);
  if (!current) { throw new ApiError(404, 'User not found'); }

  let avatarUrl: string | null = current.avatarUrl;
  let avatarPublicId: string | null = null;

  if (file) {
    const uploaded = await uploadAvatar(file.buffer);
    avatarUrl = uploaded.secureUrl;
    avatarPublicId = uploaded.publicId;

    const fullUser = await findUserById(userId);
    const oldPublicId = fullUser?.avatarPublicId ?? null;
    if (oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }
  }

  await updateUserProfileDb(userId, {
    ...(name !== undefined && { name }),
    ...(username !== undefined && { username }),
    avatarUrl,
    ...(avatarPublicId !== null && { avatarPublicId }),
  });

  return getUserProfile(userId);
};

export const getOwnedRooms = async (userId: string): Promise<RoomSummary[]> =>
  findOwnedRooms(userId);

export const getJoinedRooms = async (userId: string): Promise<JoinedRoomsResponse> => {
  const member = await findMemberRooms(userId);
  return { member };
};

export const joinRoom = async (roomId: string, userId: string): Promise<void> => {
  const existing = await findRoomMember(roomId, userId);
  if (existing) { throw new ApiError(409, 'You are already a member of this room'); }
  await joinRoomAsMember(roomId, userId);
};

export const joinRoomByCode = async (roomCode: string, userId: string): Promise<void> => {
  const room = await findRoomByCode(roomCode);
  if (!room) { throw new ApiError(404, 'Room not found'); }

  const existing = await findRoomMember(room.id, userId);
  if (existing) { throw new ApiError(409, 'You are already a member of this room'); }

  await joinRoomAsMember(room.id, userId);
};

import { findRoomByCode } from '../repositories/room.repository.js';
import { findRoomMember, joinRoomAsMember } from '../repositories/user.repository.js';
import {
  findMemberRooms,
  findOwnedRooms,
  findUserByUsername,
  findUserProfileById,
  updateUserProfile as dbUpdateUserProfile,
} from '../repositories/user.repository.js';
import type { AuthUser } from '../types/auth.types.js';
import type { JoinedRoomsResponse, RoomSummary } from '../types/room.types.js';
import { ApiError } from '../utils/apiError.js';
import { deleteFromCloudinary, uploadAvatar } from '../utils/cloudinary.js';
import { findUserById } from '../repositories/auth.repository.js';

export type UserProfile = AuthUser & { username: string | null; createdAt: Date };

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const user = await findUserProfileById(userId);

  if (!user) {throw new ApiError(404, 'User not found');}

  return user;
};

export const checkUsernameAvailability = async (username: string): Promise<void> => {
  const existing = await findUserByUsername(username);

  if (existing) {throw new ApiError(409, 'Username is already taken');}
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

  if (!current) {throw new ApiError(404, 'User not found');}

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

  await dbUpdateUserProfile(userId, {
    ...(name !== undefined && { name }),
    ...(username !== undefined && { username }),
    avatarUrl,
    ...(avatarPublicId !== null && { avatarPublicId }),
  });

  return getUserProfile(userId);
};

export const getOwnedRooms = async (userId: string): Promise<RoomSummary[]> => {
  return findOwnedRooms(userId);
};

export const getJoinedRooms = async (userId: string): Promise<JoinedRoomsResponse> => {
  const member = await findMemberRooms(userId);
  return { member };
};

export const joinRoom = async (roomId: string, userId: string): Promise<void> => {
  const existing = await findRoomMember(roomId, userId);
  if (existing) {throw new ApiError(409, 'You are already a member of this room');}
  await joinRoomAsMember(roomId, userId);
};

export const joinRoomByCode = async (roomCode: string, userId: string): Promise<void> => {
  const room = await findRoomByCode(roomCode);
  if (!room) {throw new ApiError(404, 'Room not found');}

  const existing = await findRoomMember(room.id, userId);
  if (existing) {throw new ApiError(409, 'You are already a member of this room');}

  await joinRoomAsMember(room.id, userId);
};

import { redis } from '../config/redis.js';
import { redisKeys } from './keys.js';
import type { OnlineUser } from '../socket/types.js';

const PRESENCE_TTL_SEC = 86_400; // 24 hours

export interface AddMemberResult {
  isFirstSocket: boolean;
  onlineUsers: OnlineUser[];
}

export interface RemoveMemberResult {
  isLastSocket: boolean;
  remainingUsers: OnlineUser[];
}

/**
 * Adds a socket connection for a user in a room.
 * Stores user details in an in-memory hash and tracks socket IDs in a set.
 */
export const addRoomMember = async (
  roomId: string,
  socketId: string,
  user: OnlineUser,
): Promise<AddMemberResult> => {
  const userSocketsKey = redisKeys.roomUserSockets(roomId, user.id);
  const onlineUsersKey = redisKeys.roomOnlineUsers(roomId);

  const countBefore = await redis.scard(userSocketsKey);

  const pipeline = redis.pipeline();
  pipeline.sadd(userSocketsKey, socketId);
  pipeline.expire(userSocketsKey, PRESENCE_TTL_SEC);
  pipeline.hset(onlineUsersKey, user.id, JSON.stringify(user));
  pipeline.expire(onlineUsersKey, PRESENCE_TTL_SEC);
  await pipeline.exec();

  const rawUsers = await redis.hvals(onlineUsersKey);
  const onlineUsers: OnlineUser[] = rawUsers
    .map((str) => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return {
    isFirstSocket: countBefore === 0,
    onlineUsers,
  };
};

/**
 * Removes a socket connection for a user in a room.
 * If the user has no remaining sockets in this room, removes them from online_users.
 */
export const removeRoomMember = async (
  roomId: string,
  socketId: string,
  userId: string,
): Promise<RemoveMemberResult> => {
  const userSocketsKey = redisKeys.roomUserSockets(roomId, userId);
  const onlineUsersKey = redisKeys.roomOnlineUsers(roomId);

  await redis.srem(userSocketsKey, socketId);
  const remainingSockets = await redis.scard(userSocketsKey);

  if (remainingSockets === 0) {
    await redis.del(userSocketsKey);
    await redis.hdel(onlineUsersKey, userId);
  }

  const rawUsers = await redis.hvals(onlineUsersKey);
  const remainingUsers: OnlineUser[] = rawUsers
    .map((str) => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return {
    isLastSocket: remainingSockets === 0,
    remainingUsers,
  };
};

/**
 * Retrieves all online users in a room.
 */
export const getOnlineUsers = async (roomId: string): Promise<OnlineUser[]> => {
  const onlineUsersKey = redisKeys.roomOnlineUsers(roomId);
  const rawUsers = await redis.hvals(onlineUsersKey);
  return rawUsers
    .map((str) => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

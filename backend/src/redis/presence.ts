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

export type SocketLivenessChecker = (socketId: string) => boolean;

/**
 * Adds a socket connection for a user in a room.
 * Stores user details in an in-memory hash and tracks socket IDs in a set.
 * Automatically prunes any dead socket IDs to prevent ghost users.
 */
export const addRoomMember = async (
  roomId: string,
  socketId: string,
  user: OnlineUser,
  isSocketLive?: SocketLivenessChecker,
): Promise<AddMemberResult> => {
  const userSocketsKey = redisKeys.roomUserSockets(roomId, user.id);
  const onlineUsersKey = redisKeys.roomOnlineUsers(roomId);

  // Prune any dead socket IDs for this user
  let liveSocketsBefore = 0;
  if (isSocketLive) {
    const existing = await redis.smembers(userSocketsKey);
    const dead = existing.filter((id) => !isSocketLive(id));
    if (dead.length > 0) {
      await redis.srem(userSocketsKey, ...dead);
    }
    liveSocketsBefore = existing.length - dead.length;
  } else {
    liveSocketsBefore = await redis.scard(userSocketsKey);
  }

  const pipeline = redis.pipeline();
  pipeline.sadd(userSocketsKey, socketId);
  pipeline.expire(userSocketsKey, PRESENCE_TTL_SEC);
  pipeline.hset(onlineUsersKey, user.id, JSON.stringify(user));
  pipeline.expire(onlineUsersKey, PRESENCE_TTL_SEC);
  await pipeline.exec();

  const onlineUsers = await getOnlineUsers(roomId, isSocketLive);

  return {
    isFirstSocket: liveSocketsBefore === 0,
    onlineUsers,
  };
};

/**
 * Removes a socket connection for a user in a room.
 * If the user has no remaining live sockets in this room, removes them from online_users.
 */
export const removeRoomMember = async (
  roomId: string,
  socketId: string,
  userId: string,
  isSocketLive?: SocketLivenessChecker,
): Promise<RemoveMemberResult> => {
  const userSocketsKey = redisKeys.roomUserSockets(roomId, userId);
  const onlineUsersKey = redisKeys.roomOnlineUsers(roomId);

  await redis.srem(userSocketsKey, socketId);

  // Check remaining sockets and clean up dead ones
  let remainingCount = 0;
  if (isSocketLive) {
    const existing = await redis.smembers(userSocketsKey);
    const dead = existing.filter((id) => !isSocketLive(id));
    if (dead.length > 0) {
      await redis.srem(userSocketsKey, ...dead);
    }
    remainingCount = existing.length - dead.length;
  } else {
    remainingCount = await redis.scard(userSocketsKey);
  }

  if (remainingCount === 0) {
    await redis.del(userSocketsKey);
    await redis.hdel(onlineUsersKey, userId);
  }

  const remainingUsers = await getOnlineUsers(roomId, isSocketLive);

  return {
    isLastSocket: remainingCount === 0,
    remainingUsers,
  };
};

/**
 * Retrieves all online users in a room.
 * Optionally self-heals by pruning users who have zero active sockets.
 */
export const getOnlineUsers = async (
  roomId: string,
  isSocketLive?: SocketLivenessChecker,
): Promise<OnlineUser[]> => {
  const onlineUsersKey = redisKeys.roomOnlineUsers(roomId);
  const rawHash = await redis.hgetall(onlineUsersKey);
  if (!rawHash || Object.keys(rawHash).length === 0) return [];

  const onlineUsers: OnlineUser[] = [];
  const deadUserIds: string[] = [];

  for (const [userId, jsonStr] of Object.entries(rawHash)) {
    if (isSocketLive) {
      const userSocketsKey = redisKeys.roomUserSockets(roomId, userId);
      const sockets = await redis.smembers(userSocketsKey);
      const liveSockets = sockets.filter((id) => isSocketLive(id));

      if (liveSockets.length === 0) {
        deadUserIds.push(userId);
        await redis.del(userSocketsKey);
        continue;
      } else if (liveSockets.length < sockets.length) {
        // Prune dead sockets
        const dead = sockets.filter((id) => !isSocketLive(id));
        if (dead.length > 0) {
          await redis.srem(userSocketsKey, ...dead);
        }
      }
    }

    try {
      onlineUsers.push(JSON.parse(jsonStr));
    } catch {
      // Ignore malformed JSON
    }
  }

  // Clean up dead users from hash
  if (deadUserIds.length > 0) {
    await redis.hdel(onlineUsersKey, ...deadUserIds);
  }

  return onlineUsers;
};

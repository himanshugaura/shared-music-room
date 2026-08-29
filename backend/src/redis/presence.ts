import { redis } from '../config/redis.js';
import { redisKeys } from './keys.js';
import type { OnlineUser } from '../socket/types.js';

const PRESENCE_TTL_SEC = 86_400;

export interface AddMemberResult {
  isFirstSocket: boolean;
  onlineUsers: OnlineUser[];
}

export interface RemoveMemberResult {
  isLastSocket: boolean;
  remainingUsers: OnlineUser[];
}

export type SocketLivenessChecker = (socketId: string) => boolean;

export const addRoomMember = async (
  roomId: string,
  socketId: string,
  user: OnlineUser,
  isSocketLive?: SocketLivenessChecker,
): Promise<AddMemberResult> => {
  const userSocketsKey = redisKeys.roomUserSockets(roomId, user.id);
  const onlineUsersKey = redisKeys.roomOnlineUsers(roomId);

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

export const removeRoomMember = async (
  roomId: string,
  socketId: string,
  userId: string,
  isSocketLive?: SocketLivenessChecker,
): Promise<RemoveMemberResult> => {
  const userSocketsKey = redisKeys.roomUserSockets(roomId, userId);
  const onlineUsersKey = redisKeys.roomOnlineUsers(roomId);

  await redis.srem(userSocketsKey, socketId);

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
        const dead = sockets.filter((id) => !isSocketLive(id));
        if (dead.length > 0) {
          await redis.srem(userSocketsKey, ...dead);
        }
      }
    }

    try {
      onlineUsers.push(JSON.parse(jsonStr));
    } catch {}
  }

  if (deadUserIds.length > 0) {
    await redis.hdel(onlineUsersKey, ...deadUserIds);
  }

  return onlineUsers;
};

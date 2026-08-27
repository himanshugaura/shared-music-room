import { redis } from '../config/redis.js';
import { redisKeys } from './keys.js';

const SKIP_VOTES_TTL_SEC = 86_400; // 24 hours

export interface SkipVoteResult {
  hasVoted: boolean;
  currentVotes: number;
  userIds: string[];
}

/**
 * Toggles a user's skip vote for the current song in a room.
 */
export const toggleSkipVote = async (
  roomId: string,
  songId: string,
  userId: string,
): Promise<SkipVoteResult> => {
  const key = redisKeys.roomSkipVotes(roomId, songId);

  const isMember = await redis.sismember(key, userId);

  if (isMember === 1) {
    await redis.srem(key, userId);
    const userIds = await redis.smembers(key);
    return {
      hasVoted: false,
      currentVotes: userIds.length,
      userIds,
    };
  }

  const pipeline = redis.pipeline();
  pipeline.sadd(key, userId);
  pipeline.expire(key, SKIP_VOTES_TTL_SEC);
  await pipeline.exec();

  const userIds = await redis.smembers(key);
  return {
    hasVoted: true,
    currentVotes: userIds.length,
    userIds,
  };
};

/**
 * Retrieves the current skip votes for a song.
 */
export const getSkipVotes = async (
  roomId: string,
  songId: string,
): Promise<{ currentVotes: number; userIds: string[] }> => {
  const key = redisKeys.roomSkipVotes(roomId, songId);
  const userIds = await redis.smembers(key);
  return {
    currentVotes: userIds.length,
    userIds,
  };
};

/**
 * Clears skip votes when a track finishes or skips.
 */
export const clearSkipVotes = async (
  roomId: string,
  songId: string,
): Promise<void> => {
  const key = redisKeys.roomSkipVotes(roomId, songId);
  await redis.del(key);
};

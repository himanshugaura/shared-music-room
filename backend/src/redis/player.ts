import type { MusicQueue } from '@prisma/client';
import { redis } from '../config/redis.js';
import { redisKeys } from './keys.js';

export type PlayerState = {
  queueId: string;
  isPlaying: boolean;
  currentPositionMs: number;

  playbackStartedAt: Date | null;

  currentQueueSongId: string | null;
  shuffleEnabled: boolean;
};

export type PlayerStatePatch = Partial<PlayerState>;

const PLAYER_STATE_TTL_SEC = 86_400;

const deserialize = (hash: Record<string, string>): PlayerState => ({
  queueId: hash.queueId || '',
  isPlaying: hash.isPlaying === '1',
  currentPositionMs: Number(hash.currentPositionMs ?? 0),
  playbackStartedAt: hash.playbackStartedAt ? new Date(Number(hash.playbackStartedAt)) : null,
  currentQueueSongId: hash.currentQueueSongId || null,
  shuffleEnabled: hash.shuffleEnabled === '1',
});

const serialize = (patch: PlayerStatePatch): Record<string, string> => {
  const out: Record<string, string> = {};

  if (patch.queueId !== undefined) {
    out.queueId = patch.queueId;
  }
  if (patch.isPlaying !== undefined) {
    out.isPlaying = patch.isPlaying ? '1' : '0';
  }
  if (patch.currentPositionMs !== undefined) {
    out.currentPositionMs = String(patch.currentPositionMs);
  }
  if (patch.playbackStartedAt !== undefined) {
    out.playbackStartedAt = patch.playbackStartedAt
      ? String(patch.playbackStartedAt.getTime())
      : '';
  }
  if (patch.currentQueueSongId !== undefined) {
    out.currentQueueSongId = patch.currentQueueSongId ?? '';
  }
  if (patch.shuffleEnabled !== undefined) {
    out.shuffleEnabled = patch.shuffleEnabled ? '1' : '0';
  }

  return out;
};

export const getPlayerState = async (roomId: string): Promise<PlayerState | null> => {
  const hash = await redis.hgetall(redisKeys.playerState(roomId));

  if (!hash || Object.keys(hash).length === 0) return null;

  return deserialize(hash);
};

export const patchPlayerState = async (roomId: string, patch: PlayerStatePatch): Promise<void> => {
  const fields = serialize(patch);

  if (Object.keys(fields).length === 0) return;

  const key = redisKeys.playerState(roomId);

  await redis.pipeline().hset(key, fields).expire(key, PLAYER_STATE_TTL_SEC).exec();
};

export const seedPlayerState = async (roomId: string, queue: MusicQueue): Promise<void> => {
  const key = redisKeys.playerState(roomId);

  await redis
    .pipeline()
    .hset(key, {
      queueId: queue.id,
      isPlaying: queue.isPlaying ? '1' : '0',
      currentPositionMs: String(queue.currentPositionMs),
      playbackStartedAt: queue.playbackStartedAt ? String(queue.playbackStartedAt.getTime()) : '',
      currentQueueSongId: queue.currentQueueSongId ?? '',
      shuffleEnabled: queue.shuffleEnabled ? '1' : '0',
    })
    .expire(key, PLAYER_STATE_TTL_SEC)
    .exec();
};

export const invalidatePlayerState = async (roomId: string): Promise<void> => {
  await redis.del(redisKeys.playerState(roomId));
};

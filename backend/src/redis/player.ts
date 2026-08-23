/**
 * redis/player.ts
 *
 * Low-level Redis helpers for playback state using ioredis.
 *
 * ioredis API used here:
 *   - hgetall()  → get all hash fields
 *   - hset()     → set one or many hash fields (accepts object)
 *   - expire()   → set TTL in seconds
 *   - del()      → delete a key
 *   - pipeline() → batch multiple commands in one round-trip
 */

import type { MusicQueue } from '@prisma/client';
import { redis } from '../config/redis.js';
import { redisKeys } from './keys.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayerState = {
  queueId: string;
  isPlaying: boolean;
  currentPositionMs: number;
  /** Null when paused — the moment playback began at currentPositionMs. */
  playbackStartedAt: Date | null;
  /** Null when the queue is empty. */
  currentQueueSongId: string | null;
  shuffleEnabled: boolean;
};

/** Only include fields you want to change — unspecified fields are untouched in Redis. */
export type PlayerStatePatch = Partial<PlayerState>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Expire inactive room state after 24 hours to prevent Redis bloat. */
const PLAYER_STATE_TTL_SEC = 86_400;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Converts raw ioredis hash strings into a typed PlayerState.
 * ioredis hgetall returns Record<string, string>.
 * We use "1"/"0" for booleans, numeric strings for numbers,
 * and "" as a sentinel for null (Redis has no native null type).
 */
const deserialize = (hash: Record<string, string>): PlayerState => ({
  queueId: hash.queueId || '',
  isPlaying: hash.isPlaying === '1',
  currentPositionMs: Number(hash.currentPositionMs ?? 0),
  playbackStartedAt: hash.playbackStartedAt
    ? new Date(Number(hash.playbackStartedAt))
    : null,
  currentQueueSongId: hash.currentQueueSongId || null,
  shuffleEnabled: hash.shuffleEnabled === '1',
});

/**
 * Converts a PlayerStatePatch into a flat string record for hset.
 * Only includes fields explicitly present in the patch — undefined fields
 * are skipped so they don't overwrite existing Redis values.
 */
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads the full player state from Redis.
 * Returns null on cache miss — caller should fall back to Postgres and seed.
 */
export const getPlayerState = async (roomId: string): Promise<PlayerState | null> => {
  // ioredis: hgetall returns {} (empty object) when key does not exist
  const hash = await redis.hgetall(redisKeys.playerState(roomId));

  if (!hash || Object.keys(hash).length === 0) return null;

  return deserialize(hash);
};

/**
 * Writes a partial patch to Redis.
 * Only the fields present in `patch` are updated — all others untouched.
 *
 * Uses pipeline() to batch hset + expire in a single round-trip.
 * ioredis pipeline: commands are queued and sent together, results returned as array.
 */
export const patchPlayerState = async (
  roomId: string,
  patch: PlayerStatePatch,
): Promise<void> => {
  const fields = serialize(patch);

  if (Object.keys(fields).length === 0) return;

  const key = redisKeys.playerState(roomId);

  // ioredis pipeline() — NOT multi(). pipeline() sends commands in one batch
  // but does NOT guarantee atomicity. For playback state this is fine —
  // we don't need ACID guarantees here, just performance.
  await redis
    .pipeline()
    .hset(key, fields)
    .expire(key, PLAYER_STATE_TTL_SEC)
    .exec();
};

/**
 * Seeds Redis from a Postgres MusicQueue record.
 * Call this on cache miss to warm Redis from the persistent store.
 */
export const seedPlayerState = async (
  roomId: string,
  queue: MusicQueue,
): Promise<void> => {
  const key = redisKeys.playerState(roomId);

  await redis
    .pipeline()
    .hset(key, {
      queueId: queue.id,
      isPlaying: queue.isPlaying ? '1' : '0',
      currentPositionMs: String(queue.currentPositionMs),
      playbackStartedAt: queue.playbackStartedAt
        ? String(queue.playbackStartedAt.getTime())
        : '',
      currentQueueSongId: queue.currentQueueSongId ?? '',
      shuffleEnabled: queue.shuffleEnabled ? '1' : '0',
    })
    .expire(key, PLAYER_STATE_TTL_SEC)
    .exec();
};

/**
 * Deletes the player state key from Redis.
 * Call when a room is deleted or the queue is fully cleared.
 */
export const invalidatePlayerState = async (roomId: string): Promise<void> => {
  await redis.del(redisKeys.playerState(roomId));
};

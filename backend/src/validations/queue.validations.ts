import { z } from 'zod';

export const addTrackBodySchema = z.object({
  youtubeVideoId: z.string().min(1, 'YouTube video ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  thumbnail: z.string().url('Thumbnail must be a valid URL').nullable().optional(),
  durationMs: z.number().int().positive('Duration must be a positive integer'),
});

export type AddTrackBody = z.infer<typeof addTrackBodySchema>;

export const updateQueueSettingsBodySchema = z.object({
  shuffleEnabled: z.boolean(),
});

export type UpdateQueueSettingsBody = z.infer<typeof updateQueueSettingsBodySchema>;

export const voteBodySchema = z.object({
  voteType: z.enum(['up', 'down', 'remove'], {
    message: 'voteType must be "up", "down", or "remove"',
  }),
});

export type VoteBody = z.infer<typeof voteBodySchema>;


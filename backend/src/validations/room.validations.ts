import { z } from 'zod';

export const createRoomBodySchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(100, 'Room name cannot exceed 100 characters')
    .trim(),
  description: z.string().max(500, 'Description cannot exceed 500 characters').trim().optional(),
  visibility: z.enum(['public', 'private'], {
    message: 'Visibility must be either "public" or "private"',
  }),
  shuffleEnabled: z.boolean().optional(),
});

export type CreateRoomBody = z.infer<typeof createRoomBodySchema>;


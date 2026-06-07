import { z } from 'zod';

export const checkUsernameBodySchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
});

export type CheckUsernameBody = z.infer<typeof checkUsernameBodySchema>;

export const updateProfileBodySchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(100, 'Name is too long').optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
});

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

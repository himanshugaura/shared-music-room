import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const googleAuthBodySchema = z.object({
  code: z.string().min(1, 'Google authorization code is required'),
});

export type GoogleAuthBody = z.infer<typeof googleAuthBodySchema>;

export const sendVerificationEmailBodySchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
});

export type SendVerificationEmailBody = z.infer<typeof sendVerificationEmailBodySchema>;
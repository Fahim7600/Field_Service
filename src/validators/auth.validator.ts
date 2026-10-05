import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email('Invalid email address');

const passwordSchema = z
  .string()
  .min(
    8,
    'Password must be 8-72 characters and include an uppercase letter, a lowercase letter and a number',
  )
  .max(
    72,
    'Password must be 8-72 characters and include an uppercase letter, a lowercase letter and a number',
  )
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must be 8-72 characters and include an uppercase letter, a lowercase letter and a number',
  );

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be between 2 and 100 characters')
    .max(100, 'Name must be between 2 and 100 characters'),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Password is required')
    .max(72, 'Password must not exceed 72 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: passwordSchema,
  })
  .refine((data) => data.newPassword !== data.oldPassword, {
    message: 'New password must be different from the old password',
    path: ['newPassword'],
  });

export const googleCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type GoogleCallbackQuery = z.infer<typeof googleCallbackQuerySchema>;

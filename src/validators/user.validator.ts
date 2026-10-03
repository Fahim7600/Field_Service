import { z } from 'zod';

export const updateMeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be between 2 and 100 characters')
      .max(100, 'Name must be between 2 and 100 characters')
      .optional(),
    phone: z
      .string()
      .transform((val) => val.replace(/[\s-]/g, ''))
      .pipe(z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number'))
      .optional(),
    address: z
      .string()
      .trim()
      .min(5, 'Address must be between 5 and 255 characters')
      .max(255, 'Address must be between 5 and 255 characters')
      .optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.phone !== undefined || data.address !== undefined,
    {
      message: 'Provide at least one field to update',
    },
  );

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

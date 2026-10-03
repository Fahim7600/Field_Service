import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const listQuerySchema = paginationQuery(50, 100);

export const createSkillSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Skill name must be between 2 and 60 characters')
    .max(60, 'Skill name must be between 2 and 60 characters'),
});

export const createServiceCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be between 2 and 80 characters')
    .max(80, 'Name must be between 2 and 80 characters'),
  description: z.string().trim().max(500, 'Description must not exceed 500 characters').optional(),
  skillId: z.string().uuid('Invalid skill ID'),
  basePriceCents: z.coerce.number().int().min(0, 'Base price must be a non-negative integer'),
});

export const updateServiceCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be between 2 and 80 characters')
      .max(80, 'Name must be between 2 and 80 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must not exceed 500 characters')
      .optional(),
    skillId: z.string().uuid('Invalid skill ID').optional(),
    basePriceCents: z.coerce
      .number()
      .int()
      .min(0, 'Base price must be a non-negative integer')
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.skillId !== undefined ||
      data.basePriceCents !== undefined,
    {
      message: 'Provide at least one field to update',
    },
  );

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;

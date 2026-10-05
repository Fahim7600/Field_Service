import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const listFeedbackQuery = paginationQuery(10, 100).extend({
  technicianId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type ListFeedbackQuery = z.infer<typeof listFeedbackQuery>;

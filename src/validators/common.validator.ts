import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const paginationQuery = (defaultLimit = 10, maxLimit = 100) => {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
  });
};

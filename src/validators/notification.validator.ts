import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const listNotificationsQuery = paginationQuery(10, 100).extend({
  isRead: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;

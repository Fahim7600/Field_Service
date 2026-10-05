import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const listAuditLogsQuery = paginationQuery(20, 100).extend({
  userId: z.string().uuid().optional(),
  action: z.string().trim().optional(),
  entity: z.string().trim().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuery>;

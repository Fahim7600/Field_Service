import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const listUsersQuery = paginationQuery(10, 100).extend({
  search: z.string().trim().optional(),
  role: z.enum(['CUSTOMER', 'TECHNICIAN', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['CUSTOMER', 'TECHNICIAN', 'ADMIN']),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

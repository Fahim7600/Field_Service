import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const assignTechnicianSchema = z.object({
  technicianId: z.string().uuid('Invalid technician ID format'),
});

export const rejectWorkOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be between 10 and 500 characters')
    .max(500, 'Reason must be between 10 and 500 characters'),
});

export const scheduleWorkOrderSchema = z
  .object({
    visitStart: z.coerce.date({
      error: (issue) =>
        issue.input === undefined ? 'Visit start time is required' : 'Invalid start time format',
    }),
    visitEnd: z.coerce.date({
      error: (issue) =>
        issue.input === undefined ? 'Visit end time is required' : 'Invalid end time format',
    }),
  })
  .refine(
    (data) => !Number.isNaN(data.visitStart.getTime()) && data.visitStart.getTime() > Date.now(),
    {
      message: 'Visit start time must be in the future',
      path: ['visitStart'],
    },
  )
  .refine(
    (data) =>
      !Number.isNaN(data.visitStart.getTime()) &&
      !Number.isNaN(data.visitEnd.getTime()) &&
      data.visitEnd.getTime() > data.visitStart.getTime(),
    {
      message: 'Visit end time must be later than visit start time',
      path: ['visitEnd'],
    },
  );

export const listWorkOrdersQuery = paginationQuery(10, 100).extend({
  status: z
    .enum([
      'APPROVED',
      'ASSIGNED',
      'SCHEDULED',
      'ARRIVED',
      'IN_PROGRESS',
      'COMPLETED',
      'INVOICED',
      'PAID',
      'CLOSED',
      'CANCELLED',
    ])
    .optional(),
  sortBy: z.enum(['createdAt', 'visitStart', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type AssignTechnicianInput = z.infer<typeof assignTechnicianSchema>;
export type RejectWorkOrderInput = z.infer<typeof rejectWorkOrderSchema>;
export type ScheduleWorkOrderInput = z.infer<typeof scheduleWorkOrderSchema>;
export type ListWorkOrdersQuery = z.infer<typeof listWorkOrdersQuery>;

import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const visitWindow = z
  .object({
    start: z.coerce.date({
      error: (issue) =>
        issue.input === undefined ? 'Start time is required' : 'Invalid start time format',
    }),
    end: z.coerce.date({
      error: (issue) =>
        issue.input === undefined ? 'End time is required' : 'Invalid end time format',
    }),
  })
  .refine((data) => !Number.isNaN(data.start.getTime()) && data.start.getTime() > Date.now(), {
    message: 'Start time must be in the future',
    path: ['start'],
  })
  .refine(
    (data) =>
      !Number.isNaN(data.start.getTime()) &&
      !Number.isNaN(data.end.getTime()) &&
      data.end.getTime() > data.start.getTime(),
    {
      message: 'End time must be later than start time',
      path: ['end'],
    },
  );

export const dispatchQueueQuery = paginationQuery(10, 100).extend({
  type: z.enum(['REQUEST_REVIEW', 'NEEDS_TECHNICIAN']).optional(),
});

export const reviewServiceRequestSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    reason: z
      .string()
      .trim()
      .min(10, 'Reason must be between 10 and 500 characters')
      .max(500, 'Reason must be between 10 and 500 characters')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.decision === 'REJECT') {
        return !!data.reason && data.reason.trim().length >= 10;
      }
      return true;
    },
    {
      message: 'Reason is required when rejecting a service request',
      path: ['reason'],
    },
  );

export const availableTechniciansQuery = paginationQuery(20, 100)
  .extend({
    skillId: z.string().uuid('Invalid skill ID format'),
    start: z.coerce.date({
      error: (issue) =>
        issue.input === undefined ? 'Start time is required' : 'Invalid start time format',
    }),
    end: z.coerce.date({
      error: (issue) =>
        issue.input === undefined ? 'End time is required' : 'Invalid end time format',
    }),
  })
  .refine((data) => !Number.isNaN(data.start.getTime()) && data.start.getTime() > Date.now(), {
    message: 'Start time must be in the future',
    path: ['start'],
  })
  .refine(
    (data) =>
      !Number.isNaN(data.start.getTime()) &&
      !Number.isNaN(data.end.getTime()) &&
      data.end.getTime() > data.start.getTime(),
    {
      message: 'End time must be later than start time',
      path: ['end'],
    },
  );

export type DispatchQueueQuery = z.infer<typeof dispatchQueueQuery>;
export type ReviewServiceRequestInput = z.infer<typeof reviewServiceRequestSchema>;
export type AvailableTechniciansQuery = z.infer<typeof availableTechniciansQuery>;

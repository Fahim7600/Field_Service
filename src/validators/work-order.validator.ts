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

export const rescheduleWorkOrderSchema = scheduleWorkOrderSchema;

export const updateWorkOrderStatusSchema = z.object({
  status: z.enum(['ARRIVED', 'IN_PROGRESS', 'COMPLETED'], {
    error: 'Status must be ARRIVED, IN_PROGRESS, or COMPLETED',
  }),
});

const partItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Part name must be between 1 and 100 characters')
    .max(100, 'Part name must be between 1 and 100 characters'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(1000, 'Quantity cannot exceed 1000'),
});

const partsUsedFieldSchema = z.preprocess(
  (val, ctx) => {
    if (val === undefined || val === null || val === '') {
      return [];
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'partsUsed must be valid JSON',
            path: [],
          });
          return z.NEVER;
        }
        return parsed;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'partsUsed must be valid JSON',
          path: [],
        });
        return z.NEVER;
      }
    }
    if (Array.isArray(val)) {
      return val;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'partsUsed must be valid JSON',
      path: [],
    });
    return z.NEVER;
  },
  z.array(partItemSchema).max(30, 'partsUsed cannot exceed 30 items'),
);

export const serviceReportBodySchema = z.object({
  workDone: z
    .string({
      error: 'Work done is required',
    })
    .trim()
    .min(10, 'Work done description must be between 10 and 2000 characters')
    .max(2000, 'Work done description must be between 10 and 2000 characters'),
  partsUsed: partsUsedFieldSchema.default([]),
  hoursSpent: z.preprocess(
    (val) => {
      if (typeof val === 'string' && val.trim() !== '') {
        return Number(val);
      }
      return val;
    },
    z
      .number({
        error: 'Hours spent is required and must be a number',
      })
      .min(0.25, 'Hours spent must be between 0.25 and 24')
      .max(24, 'Hours spent must be between 0.25 and 24')
      .refine(
        (v) => {
          if (!Number.isFinite(v)) return false;
          const str = v.toString();
          return /^\d+(\.\d{1,2})?$/.test(str);
        },
        {
          message: 'Hours spent must have at most 2 decimal places',
        },
      ),
  ),
});

export const cancelWorkOrderSchema = z.object({
  reason: z
    .string({
      error: 'Reason is required',
    })
    .trim()
    .min(5, 'Reason must be between 5 and 300 characters')
    .max(300, 'Reason must be between 5 and 300 characters'),
});

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

export const listServiceHistoryQuery = paginationQuery(10, 100).extend({
  status: z.enum(['COMPLETED', 'INVOICED', 'PAID', 'CLOSED', 'CANCELLED']).optional(),
  categoryId: z.string().uuid('Invalid category ID format').optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type AssignTechnicianInput = z.infer<typeof assignTechnicianSchema>;
export type RejectWorkOrderInput = z.infer<typeof rejectWorkOrderSchema>;
export type ScheduleWorkOrderInput = z.infer<typeof scheduleWorkOrderSchema>;
export type RescheduleWorkOrderInput = z.infer<typeof rescheduleWorkOrderSchema>;
export type UpdateWorkOrderStatusInput = z.infer<typeof updateWorkOrderStatusSchema>;
export type ServiceReportBodyInput = z.infer<typeof serviceReportBodySchema>;
export type CancelWorkOrderInput = z.infer<typeof cancelWorkOrderSchema>;
export type ListWorkOrdersQuery = z.infer<typeof listWorkOrdersQuery>;
export type ListServiceHistoryQuery = z.infer<typeof listServiceHistoryQuery>;

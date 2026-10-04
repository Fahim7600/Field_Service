import { z } from 'zod';
import { paginationQuery } from './common.validator';

const preferredAtSchema = z.coerce
  .date()
  .refine(
    (date) => !Number.isNaN(date.getTime()) && date.getTime() >= Date.now() + 3 * 60 * 60 * 1000,
    {
      message: 'Preferred time must be at least 3 hours from now',
    },
  )
  .refine(
    (date) =>
      !Number.isNaN(date.getTime()) && date.getTime() <= Date.now() + 60 * 24 * 60 * 60 * 1000,
    {
      message: 'Preferred time cannot be more than 60 days ahead',
    },
  );

export const createServiceRequestSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  title: z
    .string()
    .trim()
    .min(5, 'Title must be between 5 and 120 characters')
    .max(120, 'Title must be between 5 and 120 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be between 10 and 2000 characters')
    .max(2000, 'Description must be between 10 and 2000 characters'),
  address: z
    .string()
    .trim()
    .min(5, 'Address must be between 5 and 255 characters')
    .max(255, 'Address must be between 5 and 255 characters'),
  preferredAt: preferredAtSchema,
});

export const updateServiceRequestSchema = z
  .object({
    categoryId: z.string().uuid('Invalid category ID').optional(),
    title: z
      .string()
      .trim()
      .min(5, 'Title must be between 5 and 120 characters')
      .max(120, 'Title must be between 5 and 120 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .min(10, 'Description must be between 10 and 2000 characters')
      .max(2000, 'Description must be between 10 and 2000 characters')
      .optional(),
    address: z
      .string()
      .trim()
      .min(5, 'Address must be between 5 and 255 characters')
      .max(255, 'Address must be between 5 and 255 characters')
      .optional(),
    preferredAt: preferredAtSchema.optional(),
  })
  .refine(
    (data) =>
      data.categoryId !== undefined ||
      data.title !== undefined ||
      data.description !== undefined ||
      data.address !== undefined ||
      data.preferredAt !== undefined,
    {
      message: 'Provide at least one field to update',
    },
  );

export const listServiceRequestsQuery = paginationQuery(10, 100)
  .extend({
    status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
    priority: z.enum(['NORMAL', 'HIGH']).optional(),
    dateFrom: z.preprocess((val) => {
      if (typeof val === 'string' && val.trim() !== '') {
        return val.trim();
      }
      return val;
    }, z.coerce.date().optional()),
    dateTo: z.preprocess((val) => {
      if (typeof val === 'string' && val.trim() !== '') {
        const trimmed = val.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return `${trimmed}T23:59:59.999Z`;
        }
        return trimmed;
      }
      return val;
    }, z.coerce.date().optional()),
    sortBy: z.enum(['createdAt', 'preferredAt', 'priority', 'status']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return data.dateFrom <= data.dateTo;
      }
      return true;
    },
    {
      message: 'dateFrom cannot be after dateTo',
      path: ['dateFrom'],
    },
  );

export const searchServiceRequestsQuery = paginationQuery(10, 100).extend({
  q: z
    .string()
    .trim()
    .min(2, 'Search query must be between 2 and 100 characters')
    .max(100, 'Search query must be between 2 and 100 characters'),
});

export const attachmentParamSchema = z.object({
  id: z.string().uuid('Invalid request ID format'),
  attachmentId: z.string().uuid('Invalid attachment ID format'),
});

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
export type UpdateServiceRequestInput = z.infer<typeof updateServiceRequestSchema>;
export type ListServiceRequestsQuery = z.infer<typeof listServiceRequestsQuery>;
export type SearchServiceRequestsQuery = z.infer<typeof searchServiceRequestsQuery>;
export type AttachmentParams = z.infer<typeof attachmentParamSchema>;

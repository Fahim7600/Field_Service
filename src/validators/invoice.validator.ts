import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const rawInvoiceItemSchema = z.object({
  type: z.enum(['LABOR', 'PARTS', 'EXTRA'], {
    error: 'Item type must be LABOR, PARTS, or EXTRA',
  }),
  description: z
    .string({
      error: 'Description is required',
    })
    .trim()
    .min(2, 'Description must be between 2 and 200 characters')
    .max(200, 'Description must be between 2 and 200 characters'),
  quantity: z
    .number({
      error: 'Quantity is required',
    })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(1000, 'Quantity cannot exceed 1000'),
  unitAmountCents: z
    .number({
      error: 'Unit amount in cents is required',
    })
    .int('Unit amount must be an integer')
    .min(0, 'Unit amount cannot be negative')
    .max(10000000, 'Unit amount cannot exceed $100,000.00'),
});

export const createInvoiceSchema = z.object({
  workOrderId: z.string().uuid('Invalid work order ID format'),
  items: z
    .array(rawInvoiceItemSchema)
    .min(1, 'Invoice must have at least one item')
    .max(30, 'Invoice cannot have more than 30 items'),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export const updateInvoiceSchema = z
  .object({
    items: z
      .array(rawInvoiceItemSchema)
      .min(1, 'Invoice must have at least one item')
      .max(30, 'Invoice cannot have more than 30 items')
      .optional(),
    notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
  })
  .refine((data) => data.items !== undefined || data.notes !== undefined, {
    message: 'At least one of items or notes must be provided',
  });

export const voidInvoiceSchema = z.object({
  reason: z
    .string({
      error: 'Reason is required',
    })
    .trim()
    .min(5, 'Reason must be between 5 and 300 characters')
    .max(300, 'Reason must be between 5 and 300 characters'),
});

export const listInvoicesQuery = paginationQuery(10, 100).extend({
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'VOID']).optional(),
  sortBy: z.enum(['createdAt', 'totalCents', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type RawInvoiceItem = z.infer<typeof rawInvoiceItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuery>;

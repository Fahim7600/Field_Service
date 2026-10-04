import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const initiatePaymentSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID format'),
});

export const refundPaymentSchema = z.object({
  reason: z
    .string({
      error: 'Reason is required',
    })
    .trim()
    .min(5, 'Reason must be between 5 and 300 characters')
    .max(300, 'Reason must be between 5 and 300 characters'),
});

export const listPaymentsQuery = paginationQuery(10, 100).extend({
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED']).optional(),
  sortBy: z.enum(['createdAt', 'amountCents', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const sessionIdQuerySchema = z.object({
  session_id: z.string().trim().min(1, 'session_id is required'),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuery>;
export type SessionIdQuery = z.infer<typeof sessionIdQuerySchema>;

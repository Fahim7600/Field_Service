import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const checkoutSubscriptionSchema = z.object({
  planId: z.string().uuid('Invalid plan ID format'),
});

export const listSubscriptionsQuery = paginationQuery(10, 100).extend({
  status: z.enum(['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']).optional(),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const subscriptionSessionIdQuerySchema = z.object({
  session_id: z.string().optional(),
});

export type CheckoutSubscriptionInput = z.infer<typeof checkoutSubscriptionSchema>;
export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuery>;
export type SubscriptionSessionIdQuery = z.infer<typeof subscriptionSessionIdQuerySchema>;

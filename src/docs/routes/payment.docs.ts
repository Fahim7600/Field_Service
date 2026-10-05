import { z } from 'zod';
import { idParamSchema } from '../../validators/common.validator';
import {
  initiatePaymentSchema,
  listPaymentsQuery,
  sessionIdQuerySchema,
} from '../../validators/payment.validator';
import { commonErrorResponses, paginatedResponseSchema, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerPaymentDocs = () => {
  registerRoute({
    method: 'post',
    path: '/api/v1/payments/webhook',
    summary: 'Stripe webhook receiver',
    description:
      'Receives and handles asynchronous Stripe webhook events. Verified via Stripe-Signature header.',
    tags: ['Payments'],
    request: {
      headers: z.object({
        'stripe-signature': z.string().openapi({ description: 'Stripe webhook signature header' }),
      }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              type: z.string().openapi({ example: 'checkout.session.completed' }),
              data: z.object({
                object: z.record(z.string(), z.any()),
              }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Webhook processed successfully',
        content: {
          'application/json': {
            schema: z.object({ received: z.boolean() }),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'get',
    path: '/api/v1/payments/success',
    summary: 'Payment success confirmation callback',
    description:
      'Public redirect page confirming successful Stripe payment session. Public endpoint.',
    tags: ['Payments'],
    request: {
      query: sessionIdQuerySchema,
    },
    responses: {
      200: {
        description: 'Payment verified successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                paid: z.boolean(),
                invoiceId: z.string().optional(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'get',
    path: '/api/v1/payments/cancel',
    summary: 'Payment cancelled callback',
    description: 'Public redirect page when customer cancels checkout. Public endpoint.',
    tags: ['Payments'],
    request: {
      query: sessionIdQuerySchema,
    },
    responses: {
      200: {
        description: 'Cancellation recorded',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                status: z.literal('CANCELLED'),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/payments/initiate',
    summary: 'Initiate Stripe checkout session for invoice',
    description: 'Creates a Stripe Checkout Session for paying an invoice. Role: Customer.',
    tags: ['Payments'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: initiatePaymentSchema.openapi({
              example: {
                invoiceId: 'inv_cl...',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Checkout session created successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                checkoutUrl: z.string(),
                sessionId: z.string(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'get',
    path: '/api/v1/payments',
    summary: 'List payment transactions',
    description:
      'Retrieves payment history for current user or all payments for admin. Role: Customer, Admin.',
    tags: ['Payments'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listPaymentsQuery,
    },
    responses: {
      200: {
        description: 'Payments retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                amountCents: z.number(),
                status: z.string(),
                stripePaymentIntentId: z.string().nullable().optional(),
                createdAt: z.string(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'get',
    path: '/api/v1/payments/{id}',
    summary: 'Get payment details',
    description: 'Retrieves details for a specific payment transaction. Role: Customer, Admin.',
    tags: ['Payments'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Payment details retrieved successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                amountCents: z.number(),
                status: z.string(),
                invoiceId: z.string(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

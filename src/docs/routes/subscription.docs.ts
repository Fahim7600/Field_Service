import { z } from 'zod';
import {
  checkoutSubscriptionSchema,
  subscriptionSessionIdQuerySchema,
} from '../../validators/subscription.validator';
import { commonErrorResponses, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerSubscriptionDocs = () => {
  registerRoute({
    method: 'get',
    path: '/api/v1/subscription-plans',
    summary: 'List active subscription plans',
    description:
      'Retrieves available monthly and yearly premium membership plans. Public endpoint.',
    tags: ['Subscriptions'],
    responses: {
      200: {
        description: 'Subscription plans retrieved successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  interval: z.string(),
                  priceCents: z.number(),
                }),
              ),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'get',
    path: '/api/v1/subscriptions/success',
    summary: 'Subscription success confirmation',
    description: 'Public redirect page confirming subscription activation. Public endpoint.',
    tags: ['Subscriptions'],
    request: {
      query: subscriptionSessionIdQuerySchema,
    },
    responses: {
      200: {
        description: 'Subscription confirmation received',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                active: z.boolean(),
                subscriptionId: z.string().optional(),
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
    path: '/api/v1/subscriptions/cancel',
    summary: 'Subscription cancellation redirect page',
    description: 'Public redirect page when user cancels checkout. Public endpoint.',
    tags: ['Subscriptions'],
    request: {
      query: subscriptionSessionIdQuerySchema,
    },
    responses: {
      200: {
        description: 'Checkout cancellation confirmed',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ cancelled: z.literal(true) })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/subscriptions/checkout',
    summary: 'Create subscription checkout session',
    description:
      'Initiates Stripe subscription checkout for chosen plan interval (MONTH or YEAR). Role: Customer.',
    tags: ['Subscriptions'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: checkoutSubscriptionSchema.openapi({
              example: {
                interval: 'MONTH',
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
    path: '/api/v1/subscriptions/me',
    summary: 'Get current user premium subscription',
    description:
      'Retrieves current subscription status, period dates, and benefits. Role: Customer.',
    tags: ['Subscriptions'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Subscription status retrieved successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                status: z.string(),
                currentPeriodEnd: z.string(),
                plan: z.object({
                  name: z.string(),
                  interval: z.string(),
                }),
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
    path: '/api/v1/subscriptions/cancel',
    summary: 'Cancel premium subscription',
    description: 'Cancels auto-renewing subscription at end of period. Role: Customer.',
    tags: ['Subscriptions'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Subscription cancelled successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({ cancelledAt: z.string(), status: z.string() }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

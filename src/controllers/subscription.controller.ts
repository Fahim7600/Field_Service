import type { Request, Response } from 'express';
import * as subscriptionService from '../services/subscription.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { ListSubscriptionsQuery } from '../validators/subscription.validator';

export const listPlans = asyncHandler(async (_req: Request, res: Response) => {
  const data = await subscriptionService.listPlans();
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Subscription plans fetched successfully',
    data,
  });
});

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await subscriptionService.createCheckoutSession(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Checkout session created',
    data,
  });
});

export const getSuccessStatus = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, {
    statusCode: 200,
    message:
      'Thank you. Your premium subscription activates as soon as Stripe confirms the payment. Check GET /subscriptions/me',
    data: {},
  });
});

export const getCancelStatus = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Checkout was cancelled. You can subscribe again at any time',
    data: {},
  });
});

export const getMySubscription = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await subscriptionService.getMySubscription(req.user.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Subscription fetched successfully',
    data,
  });
});

export const cancelSubscription = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await subscriptionService.cancelSubscription(req.user.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Premium will stay active until the end of the paid period',
    data,
  });
});

export const listAdminSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const result = await subscriptionService.listAdminSubscriptions(
    req.query as unknown as ListSubscriptionsQuery,
  );
  return sendPaginated(res, {
    message: 'Subscriptions fetched successfully',
    ...result,
  });
});

import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { env } from '../config/env';
import { getStripe } from '../config/stripe';
import * as paymentService from '../services/payment.service';
import * as stripeWebhookService from '../services/stripe-webhook.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { ListPaymentsQuery } from '../validators/payment.validator';

export const initiatePayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await paymentService.initiatePayment(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Payment session created',
    data,
  });
});

export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new ApiError(503, 'Payments are not configured');
  }

  if (!signature || typeof signature !== 'string') {
    throw new ApiError(400, 'Invalid webhook signature');
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new ApiError(400, 'Invalid webhook signature');
  }

  const result = await stripeWebhookService.handleStripeEvent(event);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Webhook received',
    data: result,
  });
});

export const getSuccessStatus = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  const data = await paymentService.getPaymentStatusBySessionId(sessionId);
  const message =
    data.status === 'SUCCEEDED'
      ? 'Payment confirmed'
      : 'Payment is being processed. The confirmation arrives from Stripe shortly';

  return sendSuccess(res, {
    statusCode: 200,
    message,
    data,
  });
});

export const getCancelStatus = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  const data = await paymentService.getPaymentStatusBySessionId(sessionId);

  return sendSuccess(res, {
    statusCode: 200,
    message: 'Payment was cancelled. You can try again from your invoice',
    data,
  });
});

export const getPaymentById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const payment = await paymentService.getPaymentById(req.user, req.params.id);
  return sendSuccess(res, {
    message: 'Payment fetched successfully',
    data: { payment },
  });
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await paymentService.listPayments(
    req.user,
    req.query as unknown as ListPaymentsQuery,
  );
  return sendPaginated(res, {
    message: 'Payments fetched successfully',
    ...result,
  });
});

export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await paymentService.refundPayment(
    { id: req.user.id, role: req.user.role, ip: req.ip },
    req.params.id,
    req.body,
  );
  return sendSuccess(res, {
    statusCode: result.statusCode,
    message: result.message,
    data: { payment: result.payment },
  });
});

import Stripe from 'stripe';
import { ApiError } from '../utils/apiError';
import { env } from './env';

let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, 'Payments are not configured');
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeInstance;
};

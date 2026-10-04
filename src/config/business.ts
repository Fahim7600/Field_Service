export const LATE_FEE_CENTS = 500;
export const LATE_FEE_WINDOW_HOURS = 24;
export const PREMIUM_DISCOUNT_PERCENT = 10;
export const STRIPE_MIN_AMOUNT_CENTS = 50;
export const CHECKOUT_SESSION_MINUTES = 31;

export const PREMIUM_BENEFITS = [
  'Priority queue: your requests get HIGH priority and a 2-hour review target (normal customers: 24 hours)',
  '10% off the labor charge on every invoice',
  'Free cancel and reschedule until the technician arrives, with no late fee',
] as const;

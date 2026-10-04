import type { InvoiceItemType } from '@prisma/client';
import { PREMIUM_DISCOUNT_PERCENT, STRIPE_MIN_AMOUNT_CENTS } from '../config/business';
import { ApiError } from '../utils/apiError';

export interface RawInvoiceItemInput {
  type: 'LABOR' | 'PARTS' | 'EXTRA';
  description: string;
  quantity: number;
  unitAmountCents: number;
}

export interface ComputedInvoiceLine {
  type: InvoiceItemType;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

export interface ComputeInvoiceTotalsParams {
  items: RawInvoiceItemInput[];
  isPremium: boolean;
  taxPercent: number;
}

export interface ComputedInvoiceTotals {
  laborCents: number;
  partsCents: number;
  extraCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  lines: ComputedInvoiceLine[];
}

export const computeInvoiceTotals = ({
  items,
  isPremium,
  taxPercent,
}: ComputeInvoiceTotalsParams): ComputedInvoiceTotals => {
  let laborCents = 0;
  let partsCents = 0;
  let extraCents = 0;

  const lines: ComputedInvoiceLine[] = items.map((item) => {
    const amountCents = item.quantity * item.unitAmountCents;
    if (item.type === 'LABOR') {
      laborCents += amountCents;
    } else if (item.type === 'PARTS') {
      partsCents += amountCents;
    } else if (item.type === 'EXTRA') {
      extraCents += amountCents;
    }
    return {
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
      amountCents,
    };
  });

  const discountCents = isPremium ? Math.round((laborCents * PREMIUM_DISCOUNT_PERCENT) / 100) : 0;

  const taxable = laborCents + partsCents + extraCents - discountCents;
  const taxCents = Math.round((taxable * taxPercent) / 100);
  const totalCents = taxable + taxCents;

  if (discountCents > 0) {
    lines.push({
      type: 'DISCOUNT',
      description: 'Premium member discount (10% off labor)',
      quantity: 1,
      unitAmountCents: discountCents,
      amountCents: discountCents,
    });
  }

  if (taxCents > 0) {
    lines.push({
      type: 'TAX',
      description: `Tax (${taxPercent}%)`,
      quantity: 1,
      unitAmountCents: taxCents,
      amountCents: taxCents,
    });
  }

  return {
    laborCents,
    partsCents,
    extraCents,
    discountCents,
    taxCents,
    totalCents,
    lines,
  };
};

export const assertPayableTotal = (totalCents: number): void => {
  if (totalCents < STRIPE_MIN_AMOUNT_CENTS) {
    throw new ApiError(422, 'Invoice total must be at least $0.50 to be payable');
  }
};

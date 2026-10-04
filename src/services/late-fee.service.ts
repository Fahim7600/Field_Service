import type { Prisma, Role, WorkOrderStatus } from '@prisma/client';
import { LATE_FEE_CENTS, LATE_FEE_WINDOW_HOURS } from '../config/business';
import { generateInvoiceNumber } from './invoice-number.service';
import { createNotification } from './notification.service';

export interface ShouldChargeLateFeeParams {
  actorRole: Role;
  status: WorkOrderStatus;
  visitStart: Date | null;
  isPremium: boolean;
  now?: Date;
}

export const shouldChargeLateFee = ({
  actorRole,
  status,
  visitStart,
  isPremium,
  now = new Date(),
}: ShouldChargeLateFeeParams): boolean => {
  if (actorRole !== 'CUSTOMER') {
    return false;
  }
  if (status !== 'SCHEDULED') {
    return false;
  }
  if (!visitStart) {
    return false;
  }
  if (isPremium) {
    return false;
  }

  const diffMs = visitStart.getTime() - now.getTime();
  const windowMs = LATE_FEE_WINDOW_HOURS * 60 * 60 * 1000;

  return diffMs < windowMs;
};

export interface CreateLateFeeInvoiceParams {
  workOrderId: string;
  customerId: string;
  kind: 'CANCEL' | 'RESCHEDULE';
}

export interface LateFeeInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
}

export const createLateFeeInvoice = async (
  tx: Prisma.TransactionClient,
  { workOrderId, customerId, kind }: CreateLateFeeInvoiceParams,
): Promise<LateFeeInvoiceResult> => {
  const invoiceNumber = await generateInvoiceNumber(tx);
  const now = new Date();
  const notes = kind === 'CANCEL' ? 'Late cancellation fee' : 'Late reschedule fee';

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber,
      type: 'LATE_FEE',
      status: 'ISSUED',
      currency: 'usd',
      extraCents: LATE_FEE_CENTS,
      totalCents: LATE_FEE_CENTS,
      issuedAt: now,
      workOrderId,
      customerId,
      notes,
      items: {
        create: [
          {
            type: 'LATE_FEE',
            description: notes,
            quantity: 1,
            unitAmountCents: LATE_FEE_CENTS,
            amountCents: LATE_FEE_CENTS,
          },
        ],
      },
    },
  });

  await createNotification(
    {
      userId: customerId,
      type: 'INVOICE_ISSUED',
      title: 'Late fee invoice issued',
      message: 'A late fee of $5.00 has been issued',
      data: { invoiceId: invoice.id },
    },
    tx,
  );

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amountCents: invoice.totalCents,
  };
};

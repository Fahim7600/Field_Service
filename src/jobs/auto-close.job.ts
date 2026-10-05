import { AUTO_CLOSE_DAYS } from '../config/business';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { transitionWorkOrder } from '../services/work-order-state.service';

export const runAutoCloseOnce = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_DAYS * 24 * 60 * 60 * 1000);

  const workOrders = await prisma.workOrder.findMany({
    where: {
      status: 'PAID',
      deletedAt: null,
      invoices: {
        some: {
          type: 'MAIN',
          status: 'PAID',
          paidAt: { lte: cutoff },
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      customerId: true,
    },
  });

  let closedCount = 0;
  for (const wo of workOrders) {
    try {
      await prisma.$transaction(async (tx) => {
        await transitionWorkOrder(tx, {
          workOrderId: wo.id,
          to: 'CLOSED',
          actor: { id: wo.customerId, role: 'SYSTEM' },
          note: 'Closed automatically 7 days after payment',
        });
      });
      closedCount++;
    } catch {
      // If a work order was already moved by someone else (the state service throws 409), skip it silently.
    }
  }

  return closedCount;
};

export const startAutoCloseJob = () => {
  if (env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
    return;
  }

  const initialTimer = setTimeout(async () => {
    try {
      await runAutoCloseOnce();
    } catch (err: unknown) {
      console.error('Auto-close initial run error:', err instanceof Error ? err.message : err);
    }
  }, 10000);
  initialTimer.unref();

  const intervalTimer = setInterval(
    async () => {
      try {
        await runAutoCloseOnce();
      } catch (err: unknown) {
        console.error('Auto-close interval run error:', err instanceof Error ? err.message : err);
      }
    },
    60 * 60 * 1000,
  );
  intervalTimer.unref();
};

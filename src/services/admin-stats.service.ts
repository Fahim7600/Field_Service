import { ON_TIME_GRACE_MINUTES } from '../config/business';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';

export const getDashboardStats = async () => {
  const [
    requestCounts,
    workOrderCounts,
    succeededPayments,
    refundedPayments,
    activePremiumSubs,
    lateReviews,
  ] = await Promise.all([
    prisma.serviceRequest.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { status: true },
    }),
    prisma.workOrder.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { status: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amountCents: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'REFUNDED' },
      _sum: { amountCents: true },
    }),
    prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
      },
      select: { customerId: true },
      distinct: ['customerId'],
    }),
    prisma.serviceRequest.count({
      where: {
        status: 'SUBMITTED',
        deletedAt: null,
        reviewDueAt: { lt: new Date() },
      },
    }),
  ]);

  const requestsByStatus = {
    SUBMITTED: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  for (const rc of requestCounts) {
    if (rc.status in requestsByStatus) {
      requestsByStatus[rc.status as keyof typeof requestsByStatus] = rc._count.status;
    }
  }

  const workOrdersByStatus = {
    APPROVED: 0,
    ASSIGNED: 0,
    SCHEDULED: 0,
    ARRIVED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    INVOICED: 0,
    PAID: 0,
    CLOSED: 0,
    CANCELLED: 0,
  };
  for (const wc of workOrderCounts) {
    if (wc.status in workOrdersByStatus) {
      workOrdersByStatus[wc.status as keyof typeof workOrdersByStatus] = wc._count.status;
    }
  }

  return {
    requestsByStatus,
    workOrdersByStatus,
    revenue: {
      currency: 'usd',
      revenueCents: succeededPayments._sum.amountCents ?? 0,
      refundedCents: refundedPayments._sum.amountCents ?? 0,
      paymentCount: succeededPayments._count.id,
    },
    activePremiumUsers: activePremiumSubs.length,
    lateReviews,
    generatedAt: new Date().toISOString(),
  };
};

export const getTechnicianAnalytics = async (technicianId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: technicianId, role: 'TECHNICIAN', deletedAt: null },
    select: { id: true, name: true },
  });

  if (!user) {
    throw new ApiError(404, 'Technician not found');
  }

  const [jobsDone, feedbacks, visitWorkOrders, completedWorkOrders] = await Promise.all([
    prisma.workOrder.count({
      where: {
        technicianId,
        deletedAt: null,
        completedAt: { not: null },
      },
    }),
    prisma.feedback.findMany({
      where: { technicianId },
      select: { rating: true },
    }),
    prisma.workOrder.findMany({
      where: {
        technicianId,
        deletedAt: null,
        visitStart: { not: null },
        arrivedAt: { not: null },
      },
      select: { visitStart: true, arrivedAt: true },
    }),
    prisma.workOrder.findMany({
      where: {
        technicianId,
        deletedAt: null,
        startedAt: { not: null },
        completedAt: { not: null },
      },
      select: { startedAt: true, completedAt: true },
    }),
  ]);

  const ratingCount = feedbacks.length;
  const averageRating =
    ratingCount > 0
      ? Math.round((feedbacks.reduce((sum, f) => sum + f.rating, 0) / ratingCount) * 100) / 100
      : null;

  const measuredJobs = visitWorkOrders.length;
  let onTimeRate: number | null = null;
  if (measuredJobs > 0) {
    const onTimeCount = visitWorkOrders.filter((wo) => {
      if (!wo.visitStart || !wo.arrivedAt) return false;
      const graceTime = wo.visitStart.getTime() + ON_TIME_GRACE_MINUTES * 60 * 1000;
      return wo.arrivedAt.getTime() <= graceTime;
    }).length;
    onTimeRate = Math.round((onTimeCount / measuredJobs) * 1000) / 10;
  }

  let averageJobMinutes: number | null = null;
  if (completedWorkOrders.length > 0) {
    const totalMinutes = completedWorkOrders.reduce((sum, wo) => {
      if (!wo.completedAt || !wo.startedAt) return sum;
      return sum + (wo.completedAt.getTime() - wo.startedAt.getTime()) / (60 * 1000);
    }, 0);
    averageJobMinutes = Math.round((totalMinutes / completedWorkOrders.length) * 10) / 10;
  }

  return {
    technician: { id: user.id, name: user.name },
    jobsDone,
    averageRating,
    ratingCount,
    onTimeRate,
    measuredJobs,
    averageJobMinutes,
  };
};

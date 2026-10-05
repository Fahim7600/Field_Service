import type { Request, Response } from 'express';
import * as adminStatsService from '../services/admin-stats.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const data = await adminStatsService.getDashboardStats();
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Dashboard stats fetched successfully',
    data,
  });
});

export const getTechnicianAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminStatsService.getTechnicianAnalytics(req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Technician analytics fetched successfully',
    data,
  });
});

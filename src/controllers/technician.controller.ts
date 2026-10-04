import type { Request, Response } from 'express';
import * as technicianService from '../services/technician.service';
import * as workOrderService from '../services/work-order.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const profile = await technicianService.updateTechnicianProfile(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Profile updated successfully',
    data: { profile },
  });
});

export const updateSkills = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await technicianService.updateTechnicianSkills(req.user.id, req.body.skillIds);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Skills updated successfully',
    data: result,
  });
});

export const getMySchedule = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await workOrderService.getTechnicianSchedule(req.user.id, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
  });
  return sendPaginated(res, {
    message: 'Technician schedule fetched successfully',
    ...result,
  });
});

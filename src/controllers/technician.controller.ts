import type { Request, Response } from 'express';
import * as technicianService from '../services/technician.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

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

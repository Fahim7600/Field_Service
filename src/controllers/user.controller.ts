import type { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await userService.getMe(req.user.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Profile fetched successfully',
    data: result,
  });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await userService.updateMe(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Profile updated successfully',
    data: result,
  });
});

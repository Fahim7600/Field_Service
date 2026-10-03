import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.register(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created successfully',
    data: { user },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Login successful',
    data: result,
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refreshTokens(req.body.refreshToken);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Token refreshed successfully',
    data: result,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  await authService.logout(req.user.id, req.body.refreshToken);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Logged out successfully',
    data: {},
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await authService.changePassword(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Password changed successfully',
    data: result,
  });
});

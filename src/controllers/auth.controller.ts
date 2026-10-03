import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import * as authService from '../services/auth.service';
import * as googleAuthService from '../services/google-auth.service';
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

export const googleAuth = asyncHandler(async (_req: Request, res: Response) => {
  if (!googleAuthService.isGoogleConfigured()) {
    throw new ApiError(503, 'Google login is not configured');
  }

  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000,
    path: '/api/v1/auth',
  });

  return res.redirect(302, googleAuthService.getGoogleAuthUrl(state));
});

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  if (!googleAuthService.isGoogleConfigured()) {
    throw new ApiError(503, 'Google login is not configured');
  }

  if (req.query.error) {
    throw new ApiError(400, 'Google login was cancelled or denied');
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const cookieState = req.cookies?.oauth_state;

  if (!code || !state || !cookieState || state !== cookieState) {
    throw new ApiError(400, 'Invalid OAuth state');
  }

  res.clearCookie('oauth_state', { path: '/api/v1/auth' });

  const profile = await googleAuthService.getGoogleProfileFromCode(code);
  const result = await googleAuthService.loginWithGoogleProfile(profile);

  return sendSuccess(res, {
    statusCode: 200,
    message: 'Google login successful',
    data: result,
  });
});

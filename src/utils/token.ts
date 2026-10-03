import crypto from 'node:crypto';
import type { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './apiError';

export interface SignAccessTokenParams {
  userId: string;
  role: Role;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface SignRefreshTokenResult {
  token: string;
  expiresAt: Date;
}

export const signAccessToken = ({ userId, role }: SignAccessTokenParams): string => {
  const expiresIn = env.JWT_ACCESS_EXPIRES_MINUTES * 60;
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, { expiresIn });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (!decoded.sub || typeof decoded.sub !== 'string' || !decoded.role) {
      throw new ApiError(401, 'Invalid access token');
    }
    return {
      sub: decoded.sub,
      role: decoded.role as Role,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Access token expired');
    }
    throw new ApiError(401, 'Invalid access token');
  }
};

export const signRefreshToken = (userId: string): SignRefreshTokenResult => {
  const expiresIn = env.JWT_REFRESH_EXPIRES_DAYS * 86400;
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  return { token, expiresAt };
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    if (
      !decoded.sub ||
      typeof decoded.sub !== 'string' ||
      !decoded.jti ||
      typeof decoded.jti !== 'string'
    ) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }
    return {
      sub: decoded.sub,
      jti: decoded.jti,
    };
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

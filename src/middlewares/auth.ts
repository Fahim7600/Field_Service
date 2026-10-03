import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { verifyAccessToken } from '../utils/token';

const authenticateInternal = (allowPasswordChangePending: boolean) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw new ApiError(401, 'Authentication required');
      }

      const token = authHeader.substring(7).trim();
      if (!token) {
        throw new ApiError(401, 'Authentication required');
      }

      const payload = verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          role: true,
          status: true,
          mustChangePassword: true,
          deletedAt: true,
        },
      });

      if (!user || user.deletedAt !== null) {
        throw new ApiError(401, 'User no longer exists');
      }

      if (user.status !== 'ACTIVE') {
        throw new ApiError(403, 'Your account is suspended');
      }

      if (user.mustChangePassword && !allowPasswordChangePending) {
        throw new ApiError(403, 'You must change your password before continuing');
      }

      req.user = {
        id: user.id,
        role: user.role,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
};

export const authenticate = authenticateInternal(false);
export const authenticateForPasswordChange = authenticateInternal(true);

export const authorize = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }

    next();
  };
};

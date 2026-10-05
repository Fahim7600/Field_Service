import type { Request, Response } from 'express';
import * as adminUserService from '../services/admin-user.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { ListUsersQuery } from '../validators/admin-user.validator';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminUserService.listUsers(req.query as unknown as ListUsersQuery);
  return sendPaginated(res, {
    message: 'Users fetched successfully',
    ...result,
  });
});

export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await adminUserService.updateUserRole(
    { id: req.user.id, ip: req.ip },
    req.params.id,
    req.body,
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'User role updated',
    data,
  });
});

export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await adminUserService.updateUserStatus(
    { id: req.user.id, ip: req.ip },
    req.params.id,
    req.body,
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'User status updated',
    data,
  });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await adminUserService.deleteUser({ id: req.user.id, ip: req.ip }, req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'User deleted',
    data,
  });
});

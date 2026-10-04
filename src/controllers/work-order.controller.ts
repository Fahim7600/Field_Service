import type { Request, Response } from 'express';
import * as workOrderService from '../services/work-order.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { ListWorkOrdersQuery } from '../validators/work-order.validator';

export const assignTechnician = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const workOrder = await workOrderService.assignTechnician(
    { id: req.user.id, role: req.user.role, ip: req.ip },
    req.params.id,
    req.body,
  );
  return sendSuccess(res, {
    message: 'Technician assigned successfully',
    data: { workOrder },
  });
});

export const acceptWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  await workOrderService.acceptWorkOrder(
    { id: req.user.id, role: req.user.role, ip: req.ip },
    req.params.id,
  );
  return sendSuccess(res, {
    message: 'Job accepted',
    data: {},
  });
});

export const rejectWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  await workOrderService.rejectWorkOrder(
    { id: req.user.id, role: req.user.role, ip: req.ip },
    req.params.id,
    req.body,
  );
  return sendSuccess(res, {
    message: 'Job rejected and returned to the dispatch queue',
    data: {},
  });
});

export const scheduleWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const workOrder = await workOrderService.scheduleWorkOrder(
    { id: req.user.id, role: req.user.role, ip: req.ip },
    req.params.id,
    req.body,
  );
  return sendSuccess(res, {
    message: 'Visit scheduled successfully',
    data: { workOrder },
  });
});

export const listWorkOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await workOrderService.listWorkOrders(
    req.user,
    req.query as unknown as ListWorkOrdersQuery,
  );
  return sendPaginated(res, {
    message: 'Work orders fetched successfully',
    ...result,
  });
});

export const getMyAssigned = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await workOrderService.getMyAssigned(req.user.id, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
  });
  return sendPaginated(res, {
    message: 'Assigned work orders fetched successfully',
    ...result,
  });
});

export const getWorkOrderById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const workOrder = await workOrderService.getWorkOrderById(req.user, req.params.id);
  return sendSuccess(res, {
    message: 'Work order fetched successfully',
    data: { workOrder },
  });
});

export const getWorkOrderHistory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await workOrderService.getWorkOrderHistory(req.user, req.params.id, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 50,
  });
  return sendPaginated(res, {
    message: 'Work order history fetched successfully',
    ...result,
  });
});

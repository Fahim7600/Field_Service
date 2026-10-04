import type { Request, Response } from 'express';
import * as dispatchService from '../services/dispatch.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type {
  AvailableTechniciansQuery,
  DispatchQueueQuery,
} from '../validators/dispatch.validator';

export const getDispatchQueue = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await dispatchService.getDispatchQueue(req.query as unknown as DispatchQueueQuery);
  return sendPaginated(res, {
    message: 'Dispatch queue fetched successfully',
    ...result,
  });
});

export const reviewServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await dispatchService.reviewServiceRequest(
    req.user.id,
    req.params.id,
    req.body,
    req.ip,
  );
  return sendSuccess(res, {
    message:
      req.body.decision === 'APPROVE' ? 'Service request approved' : 'Service request rejected',
    data: result,
  });
});

export const getAvailableTechnicians = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await dispatchService.getAvailableTechnicians(
    req.query as unknown as AvailableTechniciansQuery,
  );
  return sendPaginated(res, {
    message: 'Available technicians fetched successfully',
    ...result,
  });
});

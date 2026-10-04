import type { Request, Response } from 'express';
import * as serviceRequestService from '../services/service-request.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type {
  ListServiceRequestsQuery,
  SearchServiceRequestsQuery,
} from '../validators/service-request.validator';

export const createServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const request = await serviceRequestService.createServiceRequest(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Service request created successfully',
    data: { request },
  });
});

export const listServiceRequests = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await serviceRequestService.listServiceRequests(
    req.user,
    req.query as unknown as ListServiceRequestsQuery,
  );
  return sendPaginated(res, {
    message: 'Service requests fetched successfully',
    ...result,
  });
});

export const searchServiceRequests = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await serviceRequestService.searchServiceRequests(
    req.user,
    req.query as unknown as SearchServiceRequestsQuery,
  );
  return sendPaginated(res, {
    message: 'Search results fetched successfully',
    ...result,
  });
});

export const getServiceRequestById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const request = await serviceRequestService.getServiceRequestById(req.user, req.params.id);
  return sendSuccess(res, {
    message: 'Service request fetched successfully',
    data: { request },
  });
});

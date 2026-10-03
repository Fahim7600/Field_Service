import type { Request, Response } from 'express';
import * as techAppService from '../services/technician-application.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { ListTechnicianApplicationsQueryInput } from '../validators/technician-application.validator';

export const applyAsTechnician = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const application = await techAppService.applyAsTechnician(req.user.id, req.body, req.file);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Application submitted successfully',
    data: { application },
  });
});

export const getMyApplication = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const application = await techAppService.getMyApplication(req.user.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Application fetched successfully',
    data: { application },
  });
});

export const listApplications = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListTechnicianApplicationsQueryInput;
  const result = await techAppService.listApplications(query);
  return sendPaginated(res, {
    message: 'Applications fetched successfully',
    items: result.items,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const getApplicationById = asyncHandler(async (req: Request, res: Response) => {
  const application = await techAppService.getApplicationById(req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Application details fetched successfully',
    data: { application },
  });
});

export const approveApplication = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await techAppService.approveApplication(req.params.id, req.user.id);
  const message = result.emailSent
    ? 'Application approved and credentials emailed'
    : 'Application approved, but the email could not be sent. Use resend-credentials';
  return sendSuccess(res, {
    statusCode: 200,
    message,
    data: result,
  });
});

export const rejectApplication = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await techAppService.rejectApplication(
    req.params.id,
    req.user.id,
    req.body.reason,
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Application rejected successfully',
    data: result,
  });
});

export const resendCredentials = asyncHandler(async (req: Request, res: Response) => {
  const result = await techAppService.resendCredentials(req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Credentials resent successfully',
    data: result,
  });
});

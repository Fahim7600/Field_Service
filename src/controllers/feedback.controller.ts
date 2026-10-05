import type { Request, Response } from 'express';
import * as feedbackService from '../services/feedback.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { ListFeedbackQuery } from '../validators/feedback.validator';

export const createFeedback = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const data = await feedbackService.createFeedback(req.user.id, req.params.id, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Feedback submitted',
    data,
  });
});

export const listFeedback = asyncHandler(async (req: Request, res: Response) => {
  const result = await feedbackService.listFeedback(req.query as unknown as ListFeedbackQuery);
  return sendPaginated(res, {
    message: 'Feedback fetched successfully',
    ...result,
  });
});

import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/apiError';

export const notFound = (req: Request, _res: Response, _next: NextFunction) => {
  throw new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`);
};

import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../utils/apiError';

export interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validate = (options: ValidateOptions) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: { field: string; message: string }[] = [];

    if (options.body) {
      const result = options.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data;
      } else {
        for (const issue of result.error.issues) {
          const pathStr = issue.path.length > 0 ? issue.path.join('.') : '';
          const field = pathStr ? `body.${pathStr}` : 'body';
          errors.push({ field, message: issue.message });
        }
      }
    }

    if (options.query) {
      const result = options.query.safeParse(req.query);
      if (result.success) {
        req.query = result.data as unknown as Request['query'];
      } else {
        for (const issue of result.error.issues) {
          const pathStr = issue.path.length > 0 ? issue.path.join('.') : '';
          const field = pathStr ? `query.${pathStr}` : 'query';
          errors.push({ field, message: issue.message });
        }
      }
    }

    if (options.params) {
      const result = options.params.safeParse(req.params);
      if (result.success) {
        req.params = result.data as unknown as Request['params'];
      } else {
        for (const issue of result.error.issues) {
          const pathStr = issue.path.length > 0 ? issue.path.join('.') : '';
          const field = pathStr ? `params.${pathStr}` : 'params';
          errors.push({ field, message: issue.message });
        }
      }
    }

    if (errors.length > 0) {
      throw new ApiError(422, 'Validation failed', errors);
    }

    next();
  };
};

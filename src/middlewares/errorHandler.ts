import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { ApiError } from '../utils/apiError';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: unknown[] = [];

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      message = 'File is too large (max 5 MB)';
    } else {
      statusCode = 400;
      message = err.message;
    }
    errors = [];
  } else if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = err.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : 'body',
      message: issue.message,
    }));
  } else if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: number }).status === 400 &&
    'body' in err
  ) {
    statusCode = 400;
    message = 'Invalid JSON body';
    errors = [];
  } else {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

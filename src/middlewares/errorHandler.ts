import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../utils/apiError';

const SENSITIVE_PATTERNS = [
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'otp',
  'onetimepassword',
  'stripesecretkey',
  'cloudinarysecret',
  'apikey',
];

const sanitizeLog = (val: unknown): unknown => {
  if (typeof val === 'string') {
    return val
      .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]')
      .replace(/(sk_test_[A-Za-z0-9]+)/gi, '[REDACTED]')
      .replace(/(whsec_[A-Za-z0-9]+)/gi, '[REDACTED]');
  }
  if (val && typeof val === 'object') {
    if (val instanceof Error) {
      return {
        name: val.name,
        message: sanitizeLog(val.message),
        ...(env.NODE_ENV !== 'production' ? { stack: val.stack } : {}),
      };
    }
    if (Array.isArray(val)) {
      return val.map(sanitizeLog);
    }
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_PATTERNS.some((p) => lower.includes(p))) {
        clean[k] = '[REDACTED]';
      } else {
        clean[k] = sanitizeLog(v);
      }
    }
    return clean;
  }
  return val;
};

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
    if (env.NODE_ENV === 'production') {
      message = 'Internal server error';
      errors = [];
    }
    console.error(sanitizeLog(err));
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

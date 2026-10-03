import type { Response } from 'express';

export interface SendSuccessOptions {
  statusCode?: number;
  message?: string;
  data?: unknown;
}

export interface SendPaginatedOptions<T = unknown> {
  message?: string;
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export const sendSuccess = (
  res: Response,
  { statusCode = 200, message = 'Operation successful', data = {} }: SendSuccessOptions = {},
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendPaginated = <T>(
  res: Response,
  { message = 'Operation successful', items, page, limit, total }: SendPaginatedOptions<T>,
) => {
  const totalPages = Math.ceil(total / limit);
  return sendSuccess(res, {
    statusCode: 200,
    message,
    data: {
      items,
      page,
      limit,
      total,
      totalPages,
    },
  });
};

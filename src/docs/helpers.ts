import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true).openapi({ example: true }),
    message: z.string().openapi({ example: 'Operation completed successfully' }),
    data: dataSchema,
  });

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.literal(true).openapi({ example: true }),
    message: z.string().openapi({ example: 'Items retrieved successfully' }),
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().openapi({ example: 1 }),
      limit: z.number().openapi({ example: 20 }),
      total: z.number().openapi({ example: 100 }),
      totalPages: z.number().openapi({ example: 5 }),
    }),
  });

export const errorResponseSchema = z.object({
  success: z.literal(false).openapi({ example: false }),
  message: z.string().openapi({ example: 'An error occurred' }),
  errors: z.array(z.string()).openapi({ example: ['Error details here'] }),
});

export const rateLimitResponseSchema = z.object({
  success: z.literal(false).openapi({ example: false }),
  message: z.string().openapi({ example: 'Too many requests, please try again later.' }),
  errors: z.array(z.string()).openapi({ example: [] }),
});

export const commonErrorResponses = {
  400: {
    description: 'Bad Request / Validation Error',
    content: {
      'application/json': {
        schema: errorResponseSchema,
      },
    },
  },
  401: {
    description: 'Unauthorized - Missing or invalid authentication token',
    content: {
      'application/json': {
        schema: errorResponseSchema,
      },
    },
  },
  403: {
    description: 'Forbidden - Insufficient permissions for this role',
    content: {
      'application/json': {
        schema: errorResponseSchema,
      },
    },
  },
  404: {
    description: 'Not Found - Resource not found',
    content: {
      'application/json': {
        schema: errorResponseSchema,
      },
    },
  },
  429: {
    description: 'Too Many Requests - Rate limit exceeded',
    content: {
      'application/json': {
        schema: rateLimitResponseSchema,
      },
    },
  },
  500: {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        schema: errorResponseSchema,
      },
    },
  },
};

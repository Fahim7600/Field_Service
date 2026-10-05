import { z } from 'zod';
import { commonErrorResponses, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerHealthDocs = () => {
  registerRoute({
    method: 'get',
    path: '/',
    summary: 'API Root & Service Directory',
    description:
      'Provides API overview, metadata, and available service navigation links. Public endpoint.',
    tags: ['Health'],
    responses: {
      200: {
        description: 'Welcome and service directory retrieved successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                name: z.string().openapi({ example: 'Field Service Management API' }),
                version: z.string().openapi({ example: '1.0.0' }),
                description: z.string().openapi({
                  example: 'RESTful API for field service operations, dispatching, and invoicing',
                }),
                endpoints: z.object({
                  documentation: z.string().openapi({ example: '/docs' }),
                  openapiSpec: z.string().openapi({ example: '/openapi.json' }),
                  health: z.string().openapi({ example: '/health' }),
                  apiHealth: z.string().openapi({ example: '/api/v1/health' }),
                  apiBase: z.string().openapi({ example: '/api/v1' }),
                }),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'get',
    path: '/health',
    summary: 'Root service health check',
    description:
      'Lightweight health check endpoint suitable for uptime monitors and deployment platform health probes. Public endpoint.',
    tags: ['Health'],
    responses: {
      200: {
        description: 'Server is healthy',
        content: {
          'application/json': {
            schema: z.object({
              status: z.literal('ok').openapi({ example: 'ok' }),
              uptime: z.number().openapi({ example: 123.45 }),
              timestamp: z.string().openapi({ example: '2026-10-06T00:00:00.000Z' }),
            }),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'get',
    path: '/api/v1/health',
    summary: 'API v1 health check',
    description:
      'Returns API health status, uptime, and current server timestamp. Public endpoint.',
    tags: ['Health'],
    responses: {
      200: {
        description: 'API is healthy',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                status: z.literal('ok').openapi({ example: 'ok' }),
                uptime: z.number().openapi({ example: 123.45 }),
                timestamp: z.string().openapi({ example: '2026-10-06T00:00:00.000Z' }),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

import { z } from 'zod';
import { commonErrorResponses, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerHealthDocs = () => {
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

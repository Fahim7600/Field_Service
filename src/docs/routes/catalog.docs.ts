import { z } from 'zod';
import { listQuerySchema } from '../../validators/catalog.validator';
import { commonErrorResponses, paginatedResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerCatalogDocs = () => {
  registerRoute({
    method: 'get',
    path: '/api/v1/skills',
    summary: 'List skills catalog',
    description:
      'Retrieves all available skills in the catalog. Role: Customer, Technician, Admin.',
    tags: ['Catalog'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listQuerySchema,
    },
    responses: {
      200: {
        description: 'Skills retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                name: z.string(),
                createdAt: z.string(),
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
    path: '/api/v1/service-categories',
    summary: 'List service categories',
    description:
      'Retrieves all service categories with pricing and linked skills. Role: Customer, Technician, Admin.',
    tags: ['Catalog'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listQuerySchema,
    },
    responses: {
      200: {
        description: 'Service categories retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                name: z.string(),
                basePriceCents: z.number(),
                skillId: z.string(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

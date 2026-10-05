import { z } from 'zod';
import { listFeedbackQuery } from '../../validators/feedback.validator';
import { commonErrorResponses, paginatedResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerFeedbackDocs = () => {
  registerRoute({
    method: 'get',
    path: '/api/v1/feedback',
    summary: 'List customer feedback and ratings',
    description: 'Retrieves all feedback submitted by customers for work orders. Role: Admin.',
    tags: ['Feedback'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listFeedbackQuery,
    },
    responses: {
      200: {
        description: 'Feedback retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                workOrderId: z.string(),
                customerId: z.string(),
                rating: z.number(),
                comment: z.string().nullable().optional(),
                createdAt: z.string(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

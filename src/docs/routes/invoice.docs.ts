import { z } from 'zod';
import { idParamSchema } from '../../validators/common.validator';
import { listInvoicesQuery } from '../../validators/invoice.validator';
import { commonErrorResponses, paginatedResponseSchema, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerInvoiceDocs = () => {
  registerRoute({
    method: 'get',
    path: '/api/v1/invoices',
    summary: 'List invoices',
    description:
      'Retrieves user or all invoices with status filtering and pagination. Role: Customer, Admin.',
    tags: ['Invoices'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listInvoicesQuery,
    },
    responses: {
      200: {
        description: 'Invoices retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                invoiceNumber: z.string(),
                status: z.string(),
                totalCents: z.number(),
                dueDate: z.string(),
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
    path: '/api/v1/invoices/{id}',
    summary: 'Get invoice details',
    description:
      'Retrieves complete invoice with item breakdown and payment status. Role: Customer, Admin.',
    tags: ['Invoices'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Invoice details retrieved successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                invoiceNumber: z.string(),
                status: z.string(),
                subtotalCents: z.number(),
                taxCents: z.number(),
                discountCents: z.number(),
                totalCents: z.number(),
                items: z.array(z.any()),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

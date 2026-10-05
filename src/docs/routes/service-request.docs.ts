import { z } from 'zod';
import { idParamSchema } from '../../validators/common.validator';
import {
  attachmentParamSchema,
  createServiceRequestSchema,
  listServiceRequestsQuery,
  searchServiceRequestsQuery,
  updateServiceRequestSchema,
} from '../../validators/service-request.validator';
import { commonErrorResponses, paginatedResponseSchema, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerServiceRequestDocs = () => {
  registerRoute({
    method: 'post',
    path: '/api/v1/service-requests',
    summary: 'Create a new service request',
    description:
      'Creates a service request for a chosen category and scheduled date. Role: Customer.',
    tags: ['Service Requests'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: createServiceRequestSchema.openapi({
              example: {
                categoryId: 'cat_cl...',
                title: 'AC unit blowing warm air',
                description:
                  'The split AC unit in the master bedroom is not cooling properly and making a buzzing noise.',
                preferredDate: '2026-10-15T10:00:00.000Z',
                address: '123 Main St, New York, NY',
              },
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Service request created successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                requestNumber: z.string(),
                title: z.string(),
                status: z.string(),
                priority: z.string(),
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
    path: '/api/v1/service-requests',
    summary: 'List service requests',
    description: 'Retrieves service requests with filtering and pagination. Role: Customer, Admin.',
    tags: ['Service Requests'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listServiceRequestsQuery,
    },
    responses: {
      200: {
        description: 'Service requests retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                requestNumber: z.string(),
                title: z.string(),
                status: z.string(),
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
    path: '/api/v1/service-requests/search',
    summary: 'Search service requests',
    description:
      'Full-text query search on service request title and description. Role: Customer, Admin.',
    tags: ['Service Requests'],
    security: [{ bearerAuth: [] }],
    request: {
      query: searchServiceRequestsQuery,
    },
    responses: {
      200: {
        description: 'Search results retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                requestNumber: z.string(),
                title: z.string(),
                status: z.string(),
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
    path: '/api/v1/service-requests/{id}',
    summary: 'Get service request details',
    description:
      'Retrieves full details of a specific service request. Role: Customer, Technician, Admin.',
    tags: ['Service Requests'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Service request details retrieved successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                requestNumber: z.string(),
                title: z.string(),
                description: z.string(),
                status: z.string(),
                priority: z.string(),
                preferredDate: z.string(),
                attachments: z.array(z.any()),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'patch',
    path: '/api/v1/service-requests/{id}',
    summary: 'Update service request',
    description: 'Updates editable fields of a pending service request. Role: Customer.',
    tags: ['Service Requests'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateServiceRequestSchema.openapi({
              example: {
                title: 'AC unit not cooling',
                description: 'Updated issue description with more details.',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Service request updated successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string() })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'delete',
    path: '/api/v1/service-requests/{id}',
    summary: 'Delete or cancel service request',
    description: 'Deletes a pending service request. Role: Customer.',
    tags: ['Service Requests'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Service request deleted successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.null()),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/service-requests/{id}/attachments',
    summary: 'Upload service request attachments',
    description: 'Uploads image attachments to Cloudinary for a service request. Role: Customer.',
    tags: ['Service Requests'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: z.object({
              files: z.array(z.string().openapi({ type: 'string', format: 'binary' })),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Attachments uploaded successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.array(z.object({ id: z.string(), fileUrl: z.string() })),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'delete',
    path: '/api/v1/service-requests/{id}/attachments/{attachmentId}',
    summary: 'Delete service request attachment',
    description: 'Removes an attachment from a service request. Role: Customer.',
    tags: ['Service Requests'],
    security: [{ bearerAuth: [] }],
    request: {
      params: attachmentParamSchema,
    },
    responses: {
      200: {
        description: 'Attachment deleted successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.null()),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

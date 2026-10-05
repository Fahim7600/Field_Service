import { z } from 'zod';
import { idParamSchema, paginationQuery } from '../../validators/common.validator';
import { createFeedbackSchema } from '../../validators/feedback.validator';
import {
  assignTechnicianSchema,
  cancelWorkOrderSchema,
  listWorkOrdersQuery,
  rejectWorkOrderSchema,
  rescheduleWorkOrderSchema,
  scheduleWorkOrderSchema,
  updateWorkOrderStatusSchema,
} from '../../validators/work-order.validator';
import { commonErrorResponses, paginatedResponseSchema, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerWorkOrderDocs = () => {
  registerRoute({
    method: 'get',
    path: '/api/v1/work-orders',
    summary: 'List work orders',
    description:
      'Retrieves work orders with role-based filtering. Role: Customer, Technician, Admin.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listWorkOrdersQuery,
    },
    responses: {
      200: {
        description: 'Work orders retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                workOrderNumber: z.string(),
                status: z.string(),
                scheduledDate: z.string().nullable().optional(),
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
    path: '/api/v1/work-orders/my-assigned',
    summary: 'List assigned work orders for technician',
    description:
      'Retrieves work orders currently assigned to the calling technician. Role: Technician.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      query: paginationQuery(10, 100),
    },
    responses: {
      200: {
        description: 'Assigned work orders retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                workOrderNumber: z.string(),
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
    path: '/api/v1/work-orders/{id}',
    summary: 'Get work order details',
    description:
      'Retrieves complete work order information including technician and customer. Role: Customer, Technician, Admin.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Work order details retrieved successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                workOrderNumber: z.string(),
                status: z.string(),
                serviceRequestId: z.string(),
                assignedTechnicianId: z.string().nullable().optional(),
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
    path: '/api/v1/work-orders/{id}/history',
    summary: 'Get work order audit history',
    description:
      'Retrieves chronological state transition history for a work order. Role: Customer, Technician, Admin.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      query: paginationQuery(50, 100),
    },
    responses: {
      200: {
        description: 'Work order history retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                fromStatus: z.string().nullable().optional(),
                toStatus: z.string(),
                reason: z.string().nullable().optional(),
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
    method: 'post',
    path: '/api/v1/work-orders/{id}/assign',
    summary: 'Assign technician to work order',
    description: 'Assigns a technician to a work order. Role: Admin.',
    tags: ['Dispatch'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: assignTechnicianSchema.openapi({
              example: {
                technicianId: 'tech_cl...',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Technician assigned successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string(), status: z.string() })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/work-orders/{id}/accept',
    summary: 'Technician accept work order assignment',
    description: 'Accepts the assigned work order (moves status to ACCEPTED). Role: Technician.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Work order accepted successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({ id: z.string(), status: z.literal('ACCEPTED') }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/work-orders/{id}/reject',
    summary: 'Technician reject work order assignment',
    description:
      'Rejects the work order assignment with a reason (moves status back to APPROVED). Role: Technician.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: rejectWorkOrderSchema.openapi({
              example: {
                reason: 'Schedule conflict with an existing high-priority repair.',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Work order rejected successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({ id: z.string(), status: z.literal('APPROVED') }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/work-orders/{id}/schedule',
    summary: 'Schedule work order appointment',
    description: 'Sets the scheduled date/time and duration for a work order. Role: Admin.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: scheduleWorkOrderSchema.openapi({
              example: {
                scheduledDate: '2026-10-15T14:00:00.000Z',
                estimatedDurationMinutes: 120,
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Work order scheduled successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string(), status: z.string() })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'patch',
    path: '/api/v1/work-orders/{id}/status',
    summary: 'Update technician work order status',
    description:
      'Advances state through EN_ROUTE, ON_SITE, IN_PROGRESS, ON_HOLD, or COMPLETED. Role: Technician.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateWorkOrderStatusSchema.openapi({
              example: {
                status: 'IN_PROGRESS',
                notes: 'Starting diagnostics on AC compressor.',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Status updated successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string(), status: z.string() })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/work-orders/{id}/service-report',
    summary: 'Submit final service report',
    description:
      'Submits work report, labor hours, parts used, and completion photos. Generates draft invoice. Role: Technician.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: z.object({
              workDone: z
                .string()
                .openapi({ example: 'Replaced failed AC capacitor and recharged refrigerant.' }),
              hoursSpent: z.number().openapi({ example: 2.5 }),
              partsUsed: z
                .string()
                .openapi({ example: '[{"name":"Run Capacitor","quantity":1,"priceCents":4500}]' }),
              photos: z.array(z.string().openapi({ type: 'string', format: 'binary' })).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Service report submitted successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                workOrderId: z.string(),
                workDone: z.string(),
                hoursSpent: z.number(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/work-orders/{id}/cancel',
    summary: 'Cancel work order',
    description: 'Cancels the work order with reason and fee calculations. Role: Customer, Admin.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: cancelWorkOrderSchema.openapi({
              example: {
                reason: 'Customer resolved the issue independently.',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Work order cancelled successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({ id: z.string(), status: z.literal('CANCELLED') }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'patch',
    path: '/api/v1/work-orders/{id}/reschedule',
    summary: 'Reschedule work order',
    description: 'Reschedules the appointment date. Role: Customer, Admin.',
    tags: ['Work Orders'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: rescheduleWorkOrderSchema.openapi({
              example: {
                scheduledDate: '2026-10-18T11:00:00.000Z',
                reason: 'Customer is out of town on the original date.',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Work order rescheduled successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string(), scheduledDate: z.string() })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/work-orders/{id}/feedback',
    summary: 'Submit customer feedback and rating',
    description:
      'Customer rates the completed work order (1-5 stars) and leaves review. Role: Customer.',
    tags: ['Feedback'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: createFeedbackSchema.openapi({
              example: {
                rating: 5,
                comment: 'Prompt, professional, and solved the cooling issue immediately!',
              },
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Feedback submitted successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                rating: z.number(),
                comment: z.string().nullable().optional(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

import { z } from 'zod';
import {
  listUsersQuery,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../../validators/admin-user.validator';
import { listAuditLogsQuery } from '../../validators/audit.validator';
import {
  createServiceCategorySchema,
  createSkillSchema,
  updateServiceCategorySchema,
} from '../../validators/catalog.validator';
import { idParamSchema } from '../../validators/common.validator';
import {
  availableTechniciansQuery,
  dispatchQueueQuery,
  reviewServiceRequestSchema,
} from '../../validators/dispatch.validator';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
} from '../../validators/invoice.validator';
import { refundPaymentSchema } from '../../validators/payment.validator';
import { listSubscriptionsQuery } from '../../validators/subscription.validator';
import {
  listTechnicianApplicationsQuerySchema,
  rejectTechnicianApplicationSchema,
} from '../../validators/technician-application.validator';
import { listServiceHistoryQuery } from '../../validators/work-order.validator';
import { commonErrorResponses, paginatedResponseSchema, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerAdminDocs = () => {
  // Admin Catalog
  registerRoute({
    method: 'post',
    path: '/api/v1/admin/skills',
    summary: 'Create a new skill in catalog',
    description: 'Adds a skill to the service catalog. Role: Admin.',
    tags: ['Catalog'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: createSkillSchema.openapi({
              example: {
                name: 'Solar Panel Maintenance',
              },
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Skill created successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string(), name: z.string() })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/admin/service-categories',
    summary: 'Create service category',
    description: 'Creates a category linked to a required skill. Role: Admin.',
    tags: ['Catalog'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: createServiceCategorySchema.openapi({
              example: {
                name: 'Solar Panel Maintenance',
                basePriceCents: 8500,
                skillId: 'skill_cl...',
              },
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Service category created successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({ id: z.string(), name: z.string(), basePriceCents: z.number() }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'patch',
    path: '/api/v1/admin/service-categories/{id}',
    summary: 'Update service category',
    description: 'Updates category price or name. Role: Admin.',
    tags: ['Catalog'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateServiceCategorySchema.openapi({
              example: {
                basePriceCents: 9000,
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Category updated successfully',
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
    path: '/api/v1/admin/service-categories/{id}',
    summary: 'Delete service category',
    description: 'Deletes a category if not in use. Role: Admin.',
    tags: ['Catalog'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Category deleted successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.null()),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // Admin Dispatch
  registerRoute({
    method: 'get',
    path: '/api/v1/admin/dispatch-queue',
    summary: 'Get dispatch queue',
    description:
      'Lists pending service requests sorted with premium customer priority. Role: Admin.',
    tags: ['Dispatch'],
    security: [{ bearerAuth: [] }],
    request: {
      query: dispatchQueueQuery,
    },
    responses: {
      200: {
        description: 'Dispatch queue retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                requestNumber: z.string(),
                priority: z.string(),
                isPremium: z.boolean(),
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
    method: 'patch',
    path: '/api/v1/admin/service-requests/{id}/review',
    summary: 'Approve or reject service request',
    description:
      'Admin reviews and approves or rejects request. If approved, creates WORK_ORDER. Role: Admin.',
    tags: ['Dispatch'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: reviewServiceRequestSchema.openapi({
              example: {
                action: 'APPROVE',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Service request reviewed successfully',
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
    method: 'get',
    path: '/api/v1/admin/technicians/available',
    summary: 'Find available matching technicians',
    description:
      'Finds available active technicians with matching skill and proximity. Role: Admin.',
    tags: ['Dispatch'],
    security: [{ bearerAuth: [] }],
    request: {
      query: availableTechniciansQuery,
    },
    responses: {
      200: {
        description: 'Available technicians retrieved',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  skills: z.array(z.string()),
                  activeJobCount: z.number(),
                }),
              ),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // Admin Stats & Analytics
  registerRoute({
    method: 'get',
    path: '/api/v1/admin/dashboard-stats',
    summary: 'Get dashboard KPI statistics',
    description:
      'Retrieves system-wide metrics (revenue, active work orders, customer count, technician utilization). Role: Admin.',
    tags: ['Analytics'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Dashboard statistics retrieved',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                totalRevenueCents: z.number(),
                activeWorkOrders: z.number(),
                pendingRequests: z.number(),
                totalTechnicians: z.number(),
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
    path: '/api/v1/admin/technicians/{id}/analytics',
    summary: 'Get technician performance analytics',
    description:
      'Retrieves completed job counts, average ratings, and turnaround times for a technician. Role: Admin.',
    tags: ['Analytics'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Technician analytics retrieved',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                technicianId: z.string(),
                completedJobs: z.number(),
                averageRating: z.number(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // Admin Audit Logs
  registerRoute({
    method: 'get',
    path: '/api/v1/admin/audit-logs',
    summary: 'List audit trail logs',
    description: 'Queries audit log records for administrative compliance. Role: Admin.',
    tags: ['Audit Logs'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listAuditLogsQuery,
    },
    responses: {
      200: {
        description: 'Audit logs retrieved',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                action: z.string(),
                entity: z.string(),
                entityId: z.string(),
                actorId: z.string().nullable().optional(),
                createdAt: z.string(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // Admin Customers
  registerRoute({
    method: 'get',
    path: '/api/v1/admin/customers/{id}/service-history',
    summary: 'Get customer service history for admin',
    description: 'Admin view of customer past work orders. Role: Admin.',
    tags: ['Users'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      query: listServiceHistoryQuery,
    },
    responses: {
      200: {
        description: 'Customer service history retrieved',
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

  // Admin Invoices
  registerRoute({
    method: 'post',
    path: '/api/v1/admin/invoices',
    summary: 'Create custom invoice',
    description: 'Manually generates an invoice for a customer/work order. Role: Admin.',
    tags: ['Invoices'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: createInvoiceSchema.openapi({
              example: {
                workOrderId: 'wo_cl...',
                dueDate: '2026-10-30T00:00:00.000Z',
                notes: 'Custom repair diagnostic invoice.',
              },
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Invoice created successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string(), invoiceNumber: z.string() })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'patch',
    path: '/api/v1/admin/invoices/{id}',
    summary: 'Update draft invoice',
    description: 'Modifies items or notes on an unpaid invoice. Role: Admin.',
    tags: ['Invoices'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateInvoiceSchema.openapi({
              example: {
                notes: 'Adjusted labor discount applied.',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Invoice updated successfully',
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
    method: 'post',
    path: '/api/v1/admin/invoices/{id}/send',
    summary: 'Send invoice to customer email',
    description: 'Dispatches invoice PDF/notification to customer. Role: Admin.',
    tags: ['Invoices'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Invoice sent successfully',
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
    path: '/api/v1/admin/invoices/{id}/void',
    summary: 'Void an invoice',
    description: 'Voids an unpaid or disputed invoice. Role: Admin.',
    tags: ['Invoices'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: voidInvoiceSchema.openapi({
              example: {
                reason: 'Customer cancelled service request prior to technician arrival.',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Invoice voided successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string(), status: z.literal('VOID') })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // Admin Payments
  registerRoute({
    method: 'post',
    path: '/api/v1/admin/payments/{id}/refund',
    summary: 'Process payment refund',
    description: 'Issues full or partial refund via Stripe. Role: Admin.',
    tags: ['Payments'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: refundPaymentSchema.openapi({
              example: {
                amountCents: 5000,
                reason: 'Customer satisfaction refund.',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Refund issued successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({ id: z.string(), status: z.literal('REFUNDED') }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // Admin Subscriptions
  registerRoute({
    method: 'get',
    path: '/api/v1/admin/subscriptions',
    summary: 'List all customer subscriptions',
    description: 'Lists all active and cancelled premium subscriptions. Role: Admin.',
    tags: ['Subscriptions'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listSubscriptionsQuery,
    },
    responses: {
      200: {
        description: 'Subscriptions list retrieved',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                userId: z.string(),
                status: z.string(),
                currentPeriodEnd: z.string(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // Admin Technician Applications
  registerRoute({
    method: 'get',
    path: '/api/v1/admin/technician-applications',
    summary: 'List technician applications',
    description: 'Lists all submitted technician onboarding applications. Role: Admin.',
    tags: ['Technician Applications'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listTechnicianApplicationsQuerySchema,
    },
    responses: {
      200: {
        description: 'Applications retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                userId: z.string(),
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
    path: '/api/v1/admin/technician-applications/{id}',
    summary: 'Get technician application details',
    description: 'Retrieves complete application with document URL and skills. Role: Admin.',
    tags: ['Technician Applications'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Application details retrieved',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                userId: z.string(),
                status: z.string(),
                bio: z.string(),
                idDocumentUrl: z.string(),
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
    path: '/api/v1/admin/technician-applications/{id}/approve',
    summary: 'Approve technician application',
    description:
      'Approves application, upgrades user role to TECHNICIAN, creates credentials and emails login details. Role: Admin.',
    tags: ['Technician Applications'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Application approved successfully',
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
    method: 'patch',
    path: '/api/v1/admin/technician-applications/{id}/reject',
    summary: 'Reject technician application',
    description: 'Rejects application with explanation reason. Role: Admin.',
    tags: ['Technician Applications'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: rejectTechnicianApplicationSchema.openapi({
              example: {
                reason: 'Unable to verify uploaded identification document.',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Application rejected',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({ id: z.string(), status: z.literal('REJECTED') }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'post',
    path: '/api/v1/admin/technician-applications/{id}/resend-credentials',
    summary: 'Resend technician onboarding credentials',
    description: 'Regenerates temporary password and resends email credentials. Role: Admin.',
    tags: ['Technician Applications'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'Credentials resent successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.null()),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // Admin Users
  registerRoute({
    method: 'get',
    path: '/api/v1/admin/users',
    summary: 'List system users',
    description: 'Lists all registered users with role and status filtering. Role: Admin.',
    tags: ['Admin'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listUsersQuery,
    },
    responses: {
      200: {
        description: 'Users retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
                role: z.string(),
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
    method: 'patch',
    path: '/api/v1/admin/users/{id}/role',
    summary: 'Update user role',
    description: 'Changes a user role (CUSTOMER, TECHNICIAN, ADMIN). Role: Admin.',
    tags: ['Admin'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateUserRoleSchema.openapi({
              example: {
                role: 'ADMIN',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'User role updated successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(z.object({ id: z.string(), role: z.string() })),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'patch',
    path: '/api/v1/admin/users/{id}/status',
    summary: 'Update user account status',
    description: 'Sets account status to ACTIVE, INACTIVE, or SUSPENDED. Role: Admin.',
    tags: ['Admin'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateUserStatusSchema.openapi({
              example: {
                status: 'SUSPENDED',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'User status updated successfully',
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
    method: 'delete',
    path: '/api/v1/admin/users/{id}',
    summary: 'Delete or deactivate user',
    description: 'Removes or deactivates a user record. Role: Admin.',
    tags: ['Admin'],
    security: [{ bearerAuth: [] }],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: 'User deleted successfully',
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

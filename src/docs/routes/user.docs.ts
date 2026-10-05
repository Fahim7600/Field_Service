import { z } from 'zod';
import { paginationQuery } from '../../validators/common.validator';
import {
  updateTechnicianProfileSchema,
  updateTechnicianSkillsSchema,
} from '../../validators/technician.validator';
import { updateMeSchema } from '../../validators/user.validator';
import { listServiceHistoryQuery } from '../../validators/work-order.validator';
import { commonErrorResponses, paginatedResponseSchema, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerUserDocs = () => {
  // Users
  registerRoute({
    method: 'get',
    path: '/api/v1/users/me',
    summary: 'Get current user profile',
    description: 'Retrieves details of the authenticated user. Role: Customer, Technician, Admin.',
    tags: ['Users'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'User profile retrieved successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
                role: z.string(),
                status: z.string(),
                phone: z.string().nullable().optional(),
                address: z.string().nullable().optional(),
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
    path: '/api/v1/users/me',
    summary: 'Update current user profile',
    description:
      'Updates profile fields for the authenticated user. Role: Customer, Technician, Admin.',
    tags: ['Users'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateMeSchema.openapi({
              example: {
                name: 'Jane Smith',
                phone: '+15559876543',
                address: '456 Elm St, New York, NY',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Profile updated successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
                phone: z.string().nullable().optional(),
                address: z.string().nullable().optional(),
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
    path: '/api/v1/customers/me/service-history',
    summary: 'Get customer service history',
    description: 'Retrieves completed work order history for the current customer. Role: Customer.',
    tags: ['Users'],
    security: [{ bearerAuth: [] }],
    request: {
      query: listServiceHistoryQuery,
    },
    responses: {
      200: {
        description: 'Service history retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                workOrderNumber: z.string(),
                status: z.string(),
                completedAt: z.string().nullable().optional(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  // Technicians
  registerRoute({
    method: 'get',
    path: '/api/v1/technicians/me/schedule',
    summary: 'Get technician schedule',
    description:
      'Retrieves assigned jobs and schedule for the current technician. Role: Technician.',
    tags: ['Technicians'],
    security: [{ bearerAuth: [] }],
    request: {
      query: paginationQuery(10, 100),
    },
    responses: {
      200: {
        description: 'Schedule retrieved successfully',
        content: {
          'application/json': {
            schema: paginatedResponseSchema(
              z.object({
                id: z.string(),
                workOrderNumber: z.string(),
                status: z.string(),
                scheduledDate: z.string().nullable().optional(),
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
    path: '/api/v1/technicians/me/profile',
    summary: 'Update technician profile',
    description: 'Updates technician bio, experience, or service area. Role: Technician.',
    tags: ['Technicians'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateTechnicianProfileSchema.openapi({
              example: {
                bio: 'Experienced HVAC and electrical technician with 8+ years experience.',
                yearsOfExperience: 8,
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Technician profile updated successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                bio: z.string().nullable().optional(),
                yearsOfExperience: z.number().nullable().optional(),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'put',
    path: '/api/v1/technicians/me/skills',
    summary: 'Update technician skill assignments',
    description:
      'Updates the list of skill IDs associated with the technician profile. Role: Technician.',
    tags: ['Technicians'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: updateTechnicianSkillsSchema.openapi({
              example: {
                skillIds: ['skill_cl...1', 'skill_cl...2'],
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Technician skills updated successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                technicianId: z.string(),
                skills: z.array(
                  z.object({
                    id: z.string(),
                    name: z.string(),
                  }),
                ),
              }),
            ),
          },
        },
      },
      ...commonErrorResponses,
    },
  });
};

import { z } from 'zod';
import { commonErrorResponses, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerTechnicianApplicationDocs = () => {
  registerRoute({
    method: 'post',
    path: '/api/v1/technician-applications',
    summary: 'Submit technician application',
    description:
      'Customer submits an application with qualifications, bio, skill IDs, and ID document upload. Role: Customer.',
    tags: ['Technician Applications'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: z.object({
              bio: z
                .string()
                .openapi({ example: 'Experienced technician with 5 years in plumbing and HVAC.' }),
              experienceYears: z.number().openapi({ example: 5 }),
              skillIds: z.string().openapi({ example: '["skill_1","skill_2"]' }),
              idDocument: z.string().openapi({ type: 'string', format: 'binary' }),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Application submitted successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                status: z.string(),
                bio: z.string(),
                experienceYears: z.number(),
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
    path: '/api/v1/technician-applications/me',
    summary: 'Get customer technician application status',
    description:
      'Retrieves the submitted technician application for the current customer. Role: Customer.',
    tags: ['Technician Applications'],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Application details retrieved successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                id: z.string(),
                status: z.string(),
                bio: z.string().nullable().optional(),
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

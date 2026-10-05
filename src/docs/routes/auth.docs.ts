import { z } from 'zod';
import {
  changePasswordSchema,
  googleCallbackQuerySchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from '../../validators/auth.validator';
import { commonErrorResponses, successResponseSchema } from '../helpers';
import { registerRoute } from '../registry';

export const registerAuthDocs = () => {
  registerRoute({
    method: 'post',
    path: '/api/v1/auth/register',
    summary: 'Register a new customer account',
    description: 'Creates a new customer account. Public endpoint.',
    tags: ['Auth'],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: registerSchema.openapi({
              example: {
                name: 'Jane Customer',
                email: 'jane@example.com',
                password: 'Password123!',
                phone: '+15551234567',
                address: '123 Main St, New York, NY',
              },
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Account created successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                user: z.object({
                  id: z.string(),
                  name: z.string(),
                  email: z.string(),
                  role: z.string(),
                }),
                accessToken: z.string(),
                refreshToken: z.string(),
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
    path: '/api/v1/auth/login',
    summary: 'Log in with email and password',
    description: 'Authenticates a user and returns JWT access and refresh tokens. Public endpoint.',
    tags: ['Auth'],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: loginSchema.openapi({
              example: {
                email: 'customer@example.com',
                password: 'Password123!',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Login successful',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                user: z.object({
                  id: z.string(),
                  name: z.string(),
                  email: z.string(),
                  role: z.string(),
                  mustChangePassword: z.boolean().optional(),
                }),
                accessToken: z.string(),
                refreshToken: z.string(),
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
    path: '/api/v1/auth/refresh-token',
    summary: 'Refresh access token',
    description: 'Generates a new access token using a valid refresh token. Public endpoint.',
    tags: ['Auth'],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: refreshTokenSchema.openapi({
              example: {
                refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Token refreshed successfully',
        content: {
          'application/json': {
            schema: successResponseSchema(
              z.object({
                accessToken: z.string(),
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
    path: '/api/v1/auth/logout',
    summary: 'Log out current session',
    description:
      'Revokes the refresh token and clears session cookie. Role: Customer, Technician, or Admin.',
    tags: ['Auth'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: refreshTokenSchema.openapi({
              example: {
                refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Logged out successfully',
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
    method: 'patch',
    path: '/api/v1/auth/change-password',
    summary: 'Change password',
    description:
      'Allows authenticated users to change their password. Role: Customer, Technician, or Admin.',
    tags: ['Auth'],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: changePasswordSchema.openapi({
              example: {
                oldPassword: 'OldPassword123!',
                newPassword: 'NewSecurePassword456!',
              },
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Password changed successfully',
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
    method: 'get',
    path: '/api/v1/auth/google',
    summary: 'Initiate Google OAuth2 login',
    description: 'Redirects to Google consent screen for OAuth2 authentication. Public endpoint.',
    tags: ['Auth'],
    responses: {
      302: {
        description: 'Redirects to Google OAuth URL',
      },
      ...commonErrorResponses,
    },
  });

  registerRoute({
    method: 'get',
    path: '/api/v1/auth/google/callback',
    summary: 'Google OAuth2 callback',
    description: 'Handles the callback from Google authentication. Public endpoint.',
    tags: ['Auth'],
    request: {
      query: googleCallbackQuerySchema,
    },
    responses: {
      302: {
        description: 'Redirects to frontend with tokens or error',
      },
      ...commonErrorResponses,
    },
  });
};

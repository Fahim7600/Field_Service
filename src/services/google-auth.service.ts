import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { issueTokens, type LoginResult, toSafeUser } from './auth.service';

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified?: boolean;
  name?: string | null;
}

export const isGoogleConfigured = (): boolean => {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL);
};

export const createOAuthClient = (): OAuth2Client => {
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);
};

export const getGoogleAuthUrl = (state: string): string => {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
};

export const getGoogleProfileFromCode = async (code: string): Promise<GoogleProfile> => {
  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new ApiError(401, 'Google authentication failed');
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new ApiError(401, 'Google authentication failed');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(401, 'Google authentication failed');
  }
};

export const loginWithGoogleProfile = async ({
  googleId,
  email,
  emailVerified,
  name,
}: GoogleProfile): Promise<LoginResult> => {
  if (emailVerified !== true) {
    throw new ApiError(401, 'Google email is not verified');
  }

  const normalizedEmail = email.trim().toLowerCase();

  let user = await prisma.user.findUnique({
    where: { googleId },
  });

  if (!user) {
    const userByEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (userByEmail) {
      if (userByEmail.googleId && userByEmail.googleId !== googleId) {
        throw new ApiError(409, 'This email is linked to another Google account');
      }

      user = await prisma.user.update({
        where: { id: userByEmail.id },
        data: { googleId },
      });
    }
  }

  if (!user) {
    const fallbackName = name?.trim() || normalizedEmail.split('@')[0].slice(0, 100);

    user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: fallbackName,
          email: normalizedEmail,
          googleId,
          passwordHash: null,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          customerProfile: {
            create: {},
          },
        },
      });

      return createdUser;
    });
  }

  if (user.deletedAt !== null) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, 'Your account is suspended');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const tokens = await issueTokens(user.id, user.role);

  return {
    user: toSafeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
};

import type { Prisma, Role, User, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { comparePassword, DUMMY_HASH, hashPassword } from '../utils/password';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token';
import type { ChangePasswordInput, LoginInput, RegisterInput } from '../validators/auth.validator';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends AuthTokens {
  user: SafeUser;
}

export interface ChangePasswordResult extends AuthTokens {
  user: SafeUser;
}

export const toSafeUser = (
  user: Pick<
    User,
    'id' | 'name' | 'email' | 'role' | 'status' | 'mustChangePassword' | 'createdAt'
  >,
): SafeUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
};

export const issueTokens = async (
  userId: string,
  role: Role,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<AuthTokens> => {
  const accessToken = signAccessToken({ userId, role });
  const { token: refreshToken, expiresAt } = signRefreshToken(userId);

  await tx.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
};

export const register = async (input: RegisterInput): Promise<SafeUser> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new ApiError(409, 'Email is already registered');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          customerProfile: {
            create: {},
          },
        },
      });

      return createdUser;
    });

    return toSafeUser(user);
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new ApiError(409, 'Email is already registered');
    }
    throw err;
  }
};

export const login = async (input: LoginInput): Promise<LoginResult> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    await comparePassword(input.password, DUMMY_HASH);
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.passwordHash || user.deletedAt !== null) {
    await comparePassword(input.password, DUMMY_HASH);
    throw new ApiError(401, 'Invalid email or password');
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, 'Your account is suspended');
  }

  if (
    user.mustChangePassword &&
    user.oneTimePasswordExpiresAt &&
    user.oneTimePasswordExpiresAt.getTime() < Date.now()
  ) {
    throw new ApiError(401, 'One-time password has expired. Please contact the admin');
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

export const refreshTokens = async (refreshToken: string): Promise<AuthTokens> => {
  verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!tokenRecord) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  if (tokenRecord.revokedAt !== null) {
    await prisma.refreshToken.updateMany({
      where: {
        userId: tokenRecord.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    throw new ApiError(401, 'Refresh token reuse detected. Please log in again');
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenRecord.userId },
  });

  if (!user || user.deletedAt !== null || user.status !== 'ACTIVE') {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  return prisma.$transaction(async (tx) => {
    const updateResult = await tx.refreshToken.updateMany({
      where: {
        id: tokenRecord.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      await tx.refreshToken.updateMany({
        where: {
          userId: tokenRecord.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
      throw new ApiError(401, 'Refresh token reuse detected. Please log in again');
    }

    return issueTokens(user.id, user.role, tx);
  });
};

export const logout = async (userId: string, refreshToken: string): Promise<void> => {
  const tokenHash = hashToken(refreshToken);
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (tokenRecord && tokenRecord.userId === userId && tokenRecord.revokedAt === null) {
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });
  }
};

export const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.deletedAt !== null) {
    throw new ApiError(401, 'User no longer exists');
  }

  if (!user.passwordHash) {
    throw new ApiError(400, 'This account has no password set');
  }

  const isOldPasswordCorrect = await comparePassword(input.oldPassword, user.passwordHash);
  if (!isOldPasswordCorrect) {
    throw new ApiError(400, 'Old password is incorrect');
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        oneTimePasswordExpiresAt: null,
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const tokens = await issueTokens(userId, updatedUser.role, tx);

    return {
      user: toSafeUser(updatedUser),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  });
};

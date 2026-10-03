import type { Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { getPremiumStatus, type PremiumStatus } from './premium.service';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: Date;
}

export interface CustomerProfileData {
  phone: string | null;
  address: string | null;
}

export interface TechnicianProfileData {
  phone: string | null;
  address: string | null;
  bio: string | null;
  serviceArea: string | null;
  yearsOfExperience: number | null;
  workingHours: unknown;
  isActive: boolean;
  skills: { id: string; name: string }[];
}

export interface GetMeResult {
  user: SafeUser;
  profile: CustomerProfileData | TechnicianProfileData | null;
  premium?: PremiumStatus;
}

export interface UpdateMeInput {
  name?: string;
  phone?: string;
  address?: string;
}

export const getMe = async (userId: string): Promise<GetMeResult> => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    include: {
      customerProfile: true,
      technicianProfile: {
        include: {
          skills: {
            include: {
              skill: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  const safeUserData: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };

  if (user.role === 'CUSTOMER') {
    let profile: CustomerProfileData | null = null;
    if (user.customerProfile && user.customerProfile.deletedAt === null) {
      profile = {
        phone: user.customerProfile.phone,
        address: user.customerProfile.address,
      };
    }
    const premium = await getPremiumStatus(user.id);
    return {
      user: safeUserData,
      profile,
      premium,
    };
  }

  if (user.role === 'TECHNICIAN') {
    let profile: TechnicianProfileData | null = null;
    if (user.technicianProfile && user.technicianProfile.deletedAt === null) {
      profile = {
        phone: user.technicianProfile.phone,
        address: user.technicianProfile.address,
        bio: user.technicianProfile.bio,
        serviceArea: user.technicianProfile.serviceArea,
        yearsOfExperience: user.technicianProfile.yearsOfExperience,
        workingHours: user.technicianProfile.workingHours,
        isActive: user.technicianProfile.isActive,
        skills: user.technicianProfile.skills.map((ts) => ({
          id: ts.skill.id,
          name: ts.skill.name,
        })),
      };
    }
    return {
      user: safeUserData,
      profile,
    };
  }

  return {
    user: safeUserData,
    profile: null,
  };
};

export const updateMe = async (userId: string, data: UpdateMeInput): Promise<GetMeResult> => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    include: {
      customerProfile: true,
      technicianProfile: true,
    },
  });

  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  if (user.role === 'ADMIN' && (data.phone !== undefined || data.address !== undefined)) {
    throw new ApiError(400, 'Admins do not have a phone number or address');
  }

  await prisma.$transaction(async (tx) => {
    if (data.name !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { name: data.name },
      });
    }

    if (user.role === 'CUSTOMER' && (data.phone !== undefined || data.address !== undefined)) {
      if (user.customerProfile) {
        await tx.customerProfile.update({
          where: { userId },
          data: {
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.address !== undefined && { address: data.address }),
          },
        });
      } else {
        await tx.customerProfile.create({
          data: {
            userId,
            phone: data.phone,
            address: data.address,
          },
        });
      }
    }

    if (user.role === 'TECHNICIAN' && (data.phone !== undefined || data.address !== undefined)) {
      if (!user.technicianProfile || user.technicianProfile.deletedAt !== null) {
        throw new ApiError(404, 'Technician profile not found');
      }
      await tx.technicianProfile.update({
        where: { userId },
        data: {
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.address !== undefined && { address: data.address }),
        },
      });
    }
  });

  return getMe(userId);
};

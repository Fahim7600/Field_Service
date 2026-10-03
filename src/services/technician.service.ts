import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type { TechnicianProfileData } from './user.service';

export interface UpdateTechnicianProfileServiceInput {
  bio?: string;
  serviceArea?: string;
  workingHours?: Record<string, unknown>;
}

export const updateTechnicianProfile = async (
  userId: string,
  data: UpdateTechnicianProfileServiceInput,
): Promise<TechnicianProfileData> => {
  const profile = await prisma.technicianProfile.findFirst({
    where: {
      userId,
      deletedAt: null,
    },
  });

  if (!profile) {
    throw new ApiError(404, 'Technician profile not found');
  }

  const updated = await prisma.technicianProfile.update({
    where: { id: profile.id },
    data: {
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.serviceArea !== undefined && { serviceArea: data.serviceArea }),
      ...(data.workingHours !== undefined && {
        workingHours: data.workingHours as Prisma.InputJsonValue,
      }),
    },
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
  });

  return {
    phone: updated.phone,
    address: updated.address,
    bio: updated.bio,
    serviceArea: updated.serviceArea,
    yearsOfExperience: updated.yearsOfExperience,
    workingHours: updated.workingHours,
    isActive: updated.isActive,
    skills: updated.skills.map((s) => ({
      id: s.skill.id,
      name: s.skill.name,
    })),
  };
};

export const updateTechnicianSkills = async (
  userId: string,
  skillIds: string[],
): Promise<{ skills: { id: string; name: string }[] }> => {
  const profile = await prisma.technicianProfile.findFirst({
    where: {
      userId,
      deletedAt: null,
    },
  });

  if (!profile) {
    throw new ApiError(404, 'Technician profile not found');
  }

  const count = await prisma.skill.count({
    where: { id: { in: skillIds } },
  });

  if (count !== skillIds.length) {
    throw new ApiError(422, 'One or more skills are invalid');
  }

  return prisma.$transaction(async (tx) => {
    await tx.technicianSkill.deleteMany({
      where: { technicianProfileId: profile.id },
    });

    await tx.technicianSkill.createMany({
      data: skillIds.map((skillId) => ({
        technicianProfileId: profile.id,
        skillId,
      })),
    });

    const skills = await tx.skill.findMany({
      where: { id: { in: skillIds } },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return { skills };
  });
};

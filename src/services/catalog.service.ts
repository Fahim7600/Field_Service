import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type {
  CreateServiceCategoryInput,
  ListQueryInput,
  UpdateServiceCategoryInput,
} from '../validators/catalog.validator';
import { writeAuditLog } from './audit.service';

export const listSkills = async ({ page, limit }: ListQueryInput) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.skill.findMany({
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.skill.count(),
  ]);

  return { items, page, limit, total };
};

export const listServiceCategories = async ({ page, limit }: ListQueryInput) => {
  const skip = (page - 1) * limit;
  const where = { deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.serviceCategory.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        basePriceCents: true,
        skill: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.serviceCategory.count({ where }),
  ]);

  return { items, page, limit, total };
};

export const createSkill = async (name: string, admin?: { id: string; ip?: string }) => {
  const existingSkill = await prisma.skill.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });

  if (existingSkill) {
    throw new ApiError(409, 'Skill already exists');
  }

  return prisma.$transaction(async (tx) => {
    const skill = await tx.skill.create({
      data: { name },
    });

    if (admin) {
      await writeAuditLog(tx, {
        actorId: admin.id,
        action: 'SKILL_CREATED',
        entity: 'Skill',
        entityId: skill.id,
        ipAddress: admin.ip,
      });
    }

    return skill;
  });
};

export const createServiceCategory = async (
  { name, description, skillId, basePriceCents }: CreateServiceCategoryInput,
  admin?: { id: string; ip?: string },
) => {
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
  });

  if (!skill) {
    throw new ApiError(404, 'Skill not found');
  }

  const existingCategory = await prisma.serviceCategory.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });

  if (existingCategory) {
    throw new ApiError(409, 'Service category name already exists');
  }

  return prisma.$transaction(async (tx) => {
    const category = await tx.serviceCategory.create({
      data: {
        name,
        description,
        skillId,
        basePriceCents,
      },
      select: {
        id: true,
        name: true,
        description: true,
        basePriceCents: true,
        skill: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (admin) {
      await writeAuditLog(tx, {
        actorId: admin.id,
        action: 'SERVICE_CATEGORY_CREATED',
        entity: 'ServiceCategory',
        entityId: category.id,
        ipAddress: admin.ip,
      });
    }

    return category;
  });
};

export const updateServiceCategory = async (
  id: string,
  data: UpdateServiceCategoryInput,
  admin?: { id: string; ip?: string },
) => {
  const category = await prisma.serviceCategory.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!category) {
    throw new ApiError(404, 'Service category not found');
  }

  if (data.skillId) {
    const skill = await prisma.skill.findUnique({
      where: { id: data.skillId },
    });
    if (!skill) {
      throw new ApiError(404, 'Skill not found');
    }
  }

  if (data.name) {
    const duplicate = await prisma.serviceCategory.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
        id: {
          not: id,
        },
      },
    });
    if (duplicate) {
      throw new ApiError(409, 'Service category name already exists');
    }
  }

  const oldValues: Prisma.JsonObject = {};
  const newValues: Prisma.JsonObject = {};

  if (data.name !== undefined && data.name !== category.name) {
    oldValues.name = category.name;
    newValues.name = data.name;
  }
  if (data.description !== undefined && data.description !== category.description) {
    oldValues.description = category.description;
    newValues.description = data.description;
  }
  if (data.skillId !== undefined && data.skillId !== category.skillId) {
    oldValues.skillId = category.skillId;
    newValues.skillId = data.skillId;
  }
  if (data.basePriceCents !== undefined && data.basePriceCents !== category.basePriceCents) {
    oldValues.basePriceCents = category.basePriceCents;
    newValues.basePriceCents = data.basePriceCents;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.serviceCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.skillId !== undefined && { skillId: data.skillId }),
        ...(data.basePriceCents !== undefined && { basePriceCents: data.basePriceCents }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        basePriceCents: true,
        skill: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (admin) {
      await writeAuditLog(tx, {
        actorId: admin.id,
        action: 'SERVICE_CATEGORY_UPDATED',
        entity: 'ServiceCategory',
        entityId: id,
        oldValues: Object.keys(oldValues).length > 0 ? oldValues : undefined,
        newValues: Object.keys(newValues).length > 0 ? newValues : undefined,
        ipAddress: admin.ip,
      });
    }

    return updated;
  });
};

export const deleteServiceCategory = async (id: string, admin?: { id: string; ip?: string }) => {
  const category = await prisma.serviceCategory.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!category) {
    throw new ApiError(404, 'Service category not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceCategory.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    if (admin) {
      await writeAuditLog(tx, {
        actorId: admin.id,
        action: 'SERVICE_CATEGORY_DELETED',
        entity: 'ServiceCategory',
        entityId: id,
        ipAddress: admin.ip,
      });
    }
  });
};

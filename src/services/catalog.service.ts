import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import type {
  CreateServiceCategoryInput,
  ListQueryInput,
  UpdateServiceCategoryInput,
} from '../validators/catalog.validator';

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

export const createSkill = async (name: string) => {
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

  return prisma.skill.create({
    data: { name },
  });
};

export const createServiceCategory = async ({
  name,
  description,
  skillId,
  basePriceCents,
}: CreateServiceCategoryInput) => {
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

  return prisma.serviceCategory.create({
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
};

export const updateServiceCategory = async (id: string, data: UpdateServiceCategoryInput) => {
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

  return prisma.serviceCategory.update({
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
};

export const deleteServiceCategory = async (id: string) => {
  const category = await prisma.serviceCategory.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!category) {
    throw new ApiError(404, 'Service category not found');
  }

  await prisma.serviceCategory.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
};

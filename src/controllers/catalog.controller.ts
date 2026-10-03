import type { Request, Response } from 'express';
import * as catalogService from '../services/catalog.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { ListQueryInput } from '../validators/catalog.validator';

export const listSkills = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListQueryInput;
  const result = await catalogService.listSkills(query);
  return sendPaginated(res, {
    message: 'Skills fetched successfully',
    items: result.items,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const listServiceCategories = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListQueryInput;
  const result = await catalogService.listServiceCategories(query);
  return sendPaginated(res, {
    message: 'Service categories fetched successfully',
    items: result.items,
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const createSkill = asyncHandler(async (req: Request, res: Response) => {
  const skill = await catalogService.createSkill(req.body.name);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Skill created successfully',
    data: { skill },
  });
});

export const createServiceCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await catalogService.createServiceCategory(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Service category created successfully',
    data: { category },
  });
});

export const updateServiceCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await catalogService.updateServiceCategory(req.params.id, req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Service category updated successfully',
    data: { category },
  });
});

export const deleteServiceCategory = asyncHandler(async (req: Request, res: Response) => {
  await catalogService.deleteServiceCategory(req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Service category deleted successfully',
    data: {},
  });
});

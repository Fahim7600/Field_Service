import type { Request, Response } from 'express';
import * as invoiceService from '../services/invoice.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/response';
import type { ListInvoicesQuery } from '../validators/invoice.validator';

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const invoice = await invoiceService.createInvoice(
    { id: req.user.id, role: req.user.role, ip: req.ip },
    req.body,
  );
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Invoice created',
    data: { invoice },
  });
});

export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const invoice = await invoiceService.updateInvoice(
    { id: req.user.id, role: req.user.role, ip: req.ip },
    req.params.id,
    req.body,
  );
  return sendSuccess(res, {
    message: 'Invoice updated',
    data: { invoice },
  });
});

export const sendInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const invoice = await invoiceService.sendInvoice(
    { id: req.user.id, role: req.user.role, ip: req.ip },
    req.params.id,
  );
  return sendSuccess(res, {
    message: 'Invoice sent to the customer',
    data: { invoice },
  });
});

export const voidInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const invoice = await invoiceService.voidInvoice(
    { id: req.user.id, role: req.user.role, ip: req.ip },
    req.params.id,
    req.body,
  );
  return sendSuccess(res, {
    message: 'Invoice voided',
    data: { invoice },
  });
});

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const result = await invoiceService.listInvoices(
    req.user,
    req.query as unknown as ListInvoicesQuery,
  );
  return sendPaginated(res, {
    message: 'Invoices fetched successfully',
    ...result,
  });
});

export const getInvoiceById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }
  const invoice = await invoiceService.getInvoiceById(req.user, req.params.id);
  return sendSuccess(res, {
    message: 'Invoice fetched successfully',
    data: { invoice },
  });
});

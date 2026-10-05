import type { Request, Response } from 'express';
import * as auditQueryService from '../services/audit-query.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated } from '../utils/response';
import type { ListAuditLogsQuery } from '../validators/audit.validator';

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditQueryService.listAuditLogs(req.query as unknown as ListAuditLogsQuery);
  return sendPaginated(res, {
    message: 'Audit logs fetched successfully',
    ...result,
  });
});

import { Router } from 'express';
import * as auditController from '../controllers/audit.controller';
import { validate } from '../middlewares/validate';
import { listAuditLogsQuery } from '../validators/audit.validator';

const router = Router();

router.get('/', validate({ query: listAuditLogsQuery }), auditController.listAuditLogs);

export default router;

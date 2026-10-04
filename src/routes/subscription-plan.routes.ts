import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller';

const router = Router();

// Public route
router.get('/', subscriptionController.listPlans);

export default router;

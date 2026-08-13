import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import { getRevenue, getTopServices, getOutstanding, getCustomers } from './analytics.controller';

const router = Router();

router.use(authenticate);
router.use(requireBusiness);

router.get('/revenue', getRevenue);
router.get('/top-services', getTopServices);
router.get('/outstanding', getOutstanding);
router.get('/customers', getCustomers);

export default router;

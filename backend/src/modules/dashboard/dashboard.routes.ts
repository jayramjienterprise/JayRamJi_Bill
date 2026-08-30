import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import { getOverview, getRecentInvoices, getRecentActivity } from './dashboard.controller';

const router = Router();

router.use(authenticate);
router.use(requireBusiness);

router.get('/overview', getOverview);
router.get('/recent-invoices', getRecentInvoices);
router.get('/recent-activity', getRecentActivity);

export default router;

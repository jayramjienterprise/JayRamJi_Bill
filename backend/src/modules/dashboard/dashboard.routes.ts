import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import { getOverview, getRecentInvoices } from './dashboard.controller';

const router = Router();

router.use(authenticate);
router.use(requireBusiness);

router.get('/overview', getOverview);
router.get('/recent-invoices', getRecentInvoices);

export default router;

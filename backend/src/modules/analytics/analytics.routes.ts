import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  getAnalyticsOverview,
  getSalesTrend,
  getPaymentMethodAnalytics,
  getReceivingAccountsAnalytics,
  getCustomerAnalytics,
  getProductAnalytics,
  getOutstandingAnalytics,
} from './analytics.controller';

const router = Router();

router.use(authenticate);
router.use(requireBusiness);

router.get('/overview', getAnalyticsOverview);
router.get('/sales-trend', getSalesTrend);
router.get('/revenue', getSalesTrend); // Backward compatibility alias
router.get('/payment-methods', getPaymentMethodAnalytics);
router.get('/receiving-accounts', getReceivingAccountsAnalytics);
router.get('/customers', getCustomerAnalytics);
router.get('/products', getProductAnalytics);
router.get('/top-services', getProductAnalytics); // Backward compatibility alias
router.get('/outstanding', getOutstandingAnalytics);

export default router;

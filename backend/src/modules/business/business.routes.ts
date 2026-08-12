import { Router } from 'express';
import {
  getBusiness,
  updateBusiness,
  updateInvoiceSettings,
  updatePaymentSettings,
} from './business.controller';
import { authenticate, requireBusiness, requireRole } from '../../middleware/auth';

const router = Router();

// Secure all endpoints with authentication and business workspace check
router.use(authenticate);
router.use(requireBusiness);

// Read business settings (Allowed for OWNER, ADMIN, STAFF)
router.get('/', getBusiness);

// Write business settings (Restricted to OWNER and ADMIN roles)
router.patch('/', requireRole(['OWNER', 'ADMIN']), updateBusiness);
router.patch('/invoice-settings', requireRole(['OWNER', 'ADMIN']), updateInvoiceSettings);
router.patch('/payment-settings', requireRole(['OWNER', 'ADMIN']), updatePaymentSettings);

export default router;

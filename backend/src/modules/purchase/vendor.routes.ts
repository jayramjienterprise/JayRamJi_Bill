import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  toggleVendorStatus,
} from './vendor.controller';
import { listVendorPayments } from './payment.controller';

const router = Router();

router.use(authenticate);
router.use(requireBusiness);

router.get('/', listVendors);
router.get('/:vendorId', getVendor);
router.get('/:vendorId/payments', listVendorPayments);
router.post('/', createVendor);
router.patch('/:vendorId', updateVendor);
router.patch('/:vendorId/toggle-status', toggleVendorStatus);

export default router;

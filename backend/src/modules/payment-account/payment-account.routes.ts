import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  listPaymentAccounts,
  getPaymentAccount,
  createPaymentAccount,
  updatePaymentAccount,
  deactivatePaymentAccount,
  activatePaymentAccount,
} from './payment-account.controller';

const router = Router();

// Apply auth & business context middleware to all payment account endpoints
router.use(authenticate);
router.use(requireBusiness);

router.get('/', listPaymentAccounts);
router.post('/', createPaymentAccount);
router.get('/:id', getPaymentAccount);
router.patch('/:id', updatePaymentAccount);
router.post('/:id/deactivate', deactivatePaymentAccount);
router.post('/:id/activate', activatePaymentAccount);

export default router;

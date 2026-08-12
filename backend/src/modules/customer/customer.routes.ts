import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deactivateCustomer,
} from './customer.controller';

const router = Router();

// Apply auth & business context middleware globally to customer routes
router.use(authenticate);
router.use(requireBusiness);

router.post('/', createCustomer);
router.get('/', listCustomers);
router.get('/:customerId', getCustomer);
router.patch('/:customerId', updateCustomer);
router.patch('/:customerId/deactivate', deactivateCustomer);

export default router;

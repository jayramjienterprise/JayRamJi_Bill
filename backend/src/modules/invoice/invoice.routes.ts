import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  createInvoiceDraft,
  getInvoice,
  updateInvoiceDraft,
  deleteInvoiceDraft,
  listInvoices,
  calculatePreview,
} from './invoice.controller';

const router = Router();

// Apply auth protection & tenancy context to all invoice endpoints
router.use(authenticate);
router.use(requireBusiness);

router.post('/', createInvoiceDraft);
router.get('/', listInvoices);
router.post('/calculate', calculatePreview);
router.get('/:id', getInvoice);
router.patch('/:id', updateInvoiceDraft);
router.delete('/:id', deleteInvoiceDraft);

export default router;

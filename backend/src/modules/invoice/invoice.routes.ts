import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  createInvoiceDraft,
  getInvoice,
  updateInvoiceDraft,
  deleteInvoiceDraft,
  listInvoices,
  calculatePreview,
  getInvoicePreviewData,
  finalizeInvoice,
  cancelInvoice,
  retrySnapshotGeneration,
  retryPdfGeneration,
  enableShareLink,
  disableShareLink,
  downloadInvoiceFile,
} from './invoice.controller';

const router = Router();

// Apply auth protection & tenancy context to all invoice endpoints
router.use(authenticate);
router.use(requireBusiness);

router.post('/', createInvoiceDraft);
router.get('/', listInvoices);
router.post('/calculate', calculatePreview);
router.get('/:id', getInvoice);
router.get('/:id/preview', getInvoicePreviewData);
router.get('/:id/download', downloadInvoiceFile);
router.patch('/:id', updateInvoiceDraft);
router.delete('/:id', deleteInvoiceDraft);

router.post('/:id/finalize', finalizeInvoice);
router.post('/:id/cancel', cancelInvoice);
router.post('/:id/documents/snapshot/retry', retrySnapshotGeneration);
router.post('/:id/documents/pdf/retry', retryPdfGeneration);

router.post('/:id/share', enableShareLink);
router.post('/:id/share/disable', disableShareLink);

export default router;

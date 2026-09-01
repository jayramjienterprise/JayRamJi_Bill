import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireBusiness } from '../../middleware/auth';
import { idempotency } from '../../middleware/idempotency';
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
  listPayments,
  recordPayment,
  reversePayment,
  uploadPaymentProof,
  getNextInvoiceNumber,
  checkInvoiceNumberAvailability,
} from './invoice.controller';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Apply auth protection & tenancy context to all invoice endpoints
router.use(authenticate);
router.use(requireBusiness);

router.get('/number/next', getNextInvoiceNumber);
router.get('/number/check', checkInvoiceNumberAvailability);

router.post('/', createInvoiceDraft);
router.get('/', listInvoices);
router.post('/calculate', calculatePreview);
router.get('/:id', getInvoice);
router.get('/:id/preview', getInvoicePreviewData);
router.get('/:id/download', downloadInvoiceFile);
router.patch('/:id', updateInvoiceDraft);
router.delete('/:id', deleteInvoiceDraft);

router.post('/:id/finalize', idempotency, finalizeInvoice);
router.post('/:id/cancel', cancelInvoice);
router.post('/:id/documents/snapshot/retry', retrySnapshotGeneration);
router.post('/:id/documents/pdf/retry', retryPdfGeneration);

router.post('/:id/share', idempotency, enableShareLink);
router.post('/:id/share/disable', disableShareLink);
router.delete('/:id/share', disableShareLink);

// Payments endpoints
router.get('/:id/payments', listPayments);
router.post('/:id/payments', idempotency, recordPayment);
router.post('/:id/payments/proof', upload.single('file'), uploadPaymentProof);
router.post('/:id/payments/:paymentId/reverse', reversePayment);

export default router;

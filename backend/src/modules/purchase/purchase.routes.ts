import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  listPurchases,
  getPurchase,
  createPurchase,
  cancelPurchase,
  checkDuplicateInvoice,
} from './purchase.controller';
import {
  receivePurchaseProducts,
  listPurchaseReceipts,
} from './receiving.controller';
import {
  recordPurchasePayment,
  listPurchasePayments,
} from './payment.controller';
import { getPurchaseDashboard } from './dashboard.controller';
import {
  extractBillDraft,
  parsePurchaseCsv,
  uploadPurchaseAttachment,
  deletePurchaseAttachment,
} from './automation.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.use(authenticate);
router.use(requireBusiness);

// Dashboards & Automation (Declared before :purchaseId)
router.get('/dashboard', getPurchaseDashboard);
router.get('/check-duplicate-invoice', checkDuplicateInvoice);
router.post('/extract-bill', upload.single('billFile'), extractBillDraft);
router.post('/parse-csv', upload.single('csvFile'), parsePurchaseCsv);

router.get('/', listPurchases);
router.get('/:purchaseId', getPurchase);
router.post('/', createPurchase);
router.patch('/:purchaseId/cancel', cancelPurchase);

// Receiving & Inward Stock
router.post('/:purchaseId/receive', receivePurchaseProducts);
router.get('/:purchaseId/receipts', listPurchaseReceipts);

// Vendor Payments
router.post('/:purchaseId/payments', recordPurchasePayment);
router.get('/:purchaseId/payments', listPurchasePayments);

// Attachments
router.post('/:purchaseId/attachments', upload.single('attachment'), uploadPurchaseAttachment);
router.delete('/:purchaseId/attachments/:attachmentId', deletePurchaseAttachment);

export default router;

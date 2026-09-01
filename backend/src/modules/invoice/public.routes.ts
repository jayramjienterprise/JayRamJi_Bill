import { Router } from 'express';
import {
  getPublicInvoice,
  downloadPublicInvoicePdf,
  downloadPublicInvoicePng,
} from './public.controller';

const router = Router();

router.get('/:token', getPublicInvoice);
router.get('/:token/pdf', downloadPublicInvoicePdf);
router.get('/:token/png', downloadPublicInvoicePng);
router.get('/:token/download', downloadPublicInvoicePdf);

export default router;

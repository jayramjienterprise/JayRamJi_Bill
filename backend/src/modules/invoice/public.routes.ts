import { Router } from 'express';
import { getPublicInvoice } from './public.controller';

const router = Router();

router.get('/:token', getPublicInvoice);

export default router;

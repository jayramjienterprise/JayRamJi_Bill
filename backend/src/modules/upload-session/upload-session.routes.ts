import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  createUploadSession,
  getUploadSessionStatus,
  cancelUploadSession,
  getPublicUploadSession,
  uploadPublicProof,
  directProofUpload,
} from './upload-session.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();

// Public routes (Used by mobile phone scanning QR code)
router.get('/public/:token', getPublicUploadSession);
router.post('/public/:token/upload', upload.single('file'), uploadPublicProof);

// Protected routes (Used by authenticated desktop/laptop billing user)
router.post('/', authenticate, requireBusiness, createUploadSession);
router.get('/:id/status', authenticate, requireBusiness, getUploadSessionStatus);
router.post('/:id/cancel', authenticate, requireBusiness, cancelUploadSession);
router.post('/direct-upload', authenticate, requireBusiness, upload.single('file'), directProofUpload);

export default router;

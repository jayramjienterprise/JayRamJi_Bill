import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireBusiness, requireRole } from '../../middleware/auth';
import {
  uploadAsset,
  listAssets,
  activateAsset,
  deactivateAsset,
} from './asset.controller';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Apply auth & business context middleware globally to asset routes
router.use(authenticate);
router.use(requireBusiness);

// Write actions require OWNER or ADMIN roles. STAFF is view-only.
router.post('/', requireRole(['OWNER', 'ADMIN']), upload.single('file'), uploadAsset);
router.patch('/:assetId/activate', requireRole(['OWNER', 'ADMIN']), activateAsset);
router.patch('/:assetId/deactivate', requireRole(['OWNER', 'ADMIN']), deactivateAsset);

// STAFF can read/list assets to render template previews
router.get('/', listAssets);

export default router;

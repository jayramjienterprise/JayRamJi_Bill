import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deactivateProduct,
} from './product.controller';

const router = Router();

// Apply auth & business context middleware globally to product routes
router.use(authenticate);
router.use(requireBusiness);

router.post('/', createProduct);
router.get('/', listProducts);
router.get('/:productId', getProduct);
router.patch('/:productId', updateProduct);
router.patch('/:productId/deactivate', deactivateProduct);

export default router;

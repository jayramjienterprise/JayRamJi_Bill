import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  listConditions,
  createCondition,
  updateCondition,
  deleteCondition,
} from './condition.controller';

const router = Router();

// Apply auth & business context middleware
router.use(authenticate);
router.use(requireBusiness);

router.get('/', listConditions);
router.post('/', createCondition);
router.put('/:id', updateCondition);
router.delete('/:id', deleteCondition);

export default router;

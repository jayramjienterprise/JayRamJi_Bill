import { Router } from 'express';
import { register, login, logout, me, forgotPassword, resetPassword } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Public auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected auth routes
router.get('/me', authenticate, me);

export default router;

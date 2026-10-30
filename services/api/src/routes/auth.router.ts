import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public — strict rate limiter applied
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Protected
router.get('/me', authenticate, me);

export default router;

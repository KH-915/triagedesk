import { Router } from 'express';
import authRouter from './auth.router';
import ticketRouter from './ticket.router';
import healthRouter from './health.router';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// General rate limiter applies to all routes.
// The auth limiter is applied per-route inside auth.router.ts for tighter control.
router.use(generalLimiter);

router.use('/auth', authRouter);
router.use('/tickets', ticketRouter);
router.use('/health', healthRouter);

export default router;

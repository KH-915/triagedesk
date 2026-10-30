import rateLimit from 'express-rate-limit';

// The integration suite logs in from one IP far more than 10x/min; limiters are off under test only.
const skipInTest = () => process.env.NODE_ENV === 'test';

const rateLimitErrorBody = {
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please wait a moment and try again.',
  },
};

/**
 * Strict rate limiter for auth endpoints (register, login).
 * Spec §8.5: max 10 requests per IP per minute.
 */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitErrorBody,
  skipSuccessfulRequests: false,
  skip: skipInTest,
});

/**
 * General rate limiter for all other API endpoints.
 * Spec §8.5: max 100 requests per IP per minute.
 */
export const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitErrorBody,
  skip: skipInTest,
});

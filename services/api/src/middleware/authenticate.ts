import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '../types';

/**
 * Verifies the Bearer JWT in the Authorization header.
 * On success, attaches the decoded payload to req.user and calls next().
 * On failure, returns 401 — never 403.
 *
 * Spec §8.1: "Token validation failures return 401, not 403."
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Provide an Authorization: Bearer <token> header.',
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    // Attach to request using type assertion; req.user is typed via AuthenticatedRequest
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token is invalid or has expired. Please log in again.',
      },
    });
  }
}

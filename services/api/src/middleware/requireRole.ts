import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { JwtPayload } from '../types';

/**
 * Middleware factory that rejects requests from users without the required role.
 * Must be used after authenticate() in the middleware chain.
 *
 * Usage:
 *   router.patch('/:id', authenticate, requireRole(Role.AGENT), handler)
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as Request & { user?: JwtPayload }).user;

    if (!user) {
      // Should not happen if requireRole() is always placed after authenticate()
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `This action requires the ${roles.join(' or ')} role.`,
        },
      });
      return;
    }

    next();
  };
}

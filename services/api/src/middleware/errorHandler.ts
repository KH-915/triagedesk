import { Request, Response, NextFunction } from 'express';

/**
 * Structured application error.
 * Throw instances of this class from services and controllers to produce
 * consistent JSON error responses.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Global error-handling middleware.
 * Must be the LAST middleware registered in app.ts.
 *
 * Spec §8.10:
 * - AppError → structured JSON with the provided status code.
 * - Unknown errors → 500 with a generic message; internal details are logged
 *   server-side but NEVER sent to the client.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  // Unknown / unhandled error: log full details server-side only
  console.error('[Unhandled Error]', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : '[redacted]',
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  });
}

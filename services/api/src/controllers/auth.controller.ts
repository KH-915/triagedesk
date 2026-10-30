import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { registerUser, loginUser, getUserById } from '../services/auth.service';
import { JwtPayload } from '../types';
import { AppError } from '../middleware/errorHandler';

/** Converts a ZodError into the field-level map used by the error response shape. */
function zodToFields(err: ZodError): Record<string, string> {
  return err.errors.reduce<Record<string, string>>((acc, issue) => {
    const key = issue.path.join('.') || 'input';
    acc[key] = issue.message;
    return acc;
  }, {});
}

// ─── Handlers ─────────────────────────────────────────────────

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input.', zodToFields(parsed.error));
    }
    const user = await registerUser(parsed.data);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input.', zodToFields(parsed.error));
    }
    const result = await loginUser(parsed.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as Request & { user: JwtPayload }).user;
    const profile = await getUserById(user.sub);
    if (!profile) {
      // Should not happen if the JWT was issued by this service
      throw new AppError(404, 'NOT_FOUND', 'User account not found.');
    }
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

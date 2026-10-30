import { Request } from 'express';
import { Role } from '@prisma/client';

// ─── JWT ─────────────────────────────────────────────────────

/** Shape of the decoded JWT payload attached to req.user after authenticate(). */
export interface JwtPayload {
  sub: string;   // user UUID
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// ─── Express augmentation ─────────────────────────────────────

/** Extends Express.Request with the decoded user payload from the JWT middleware. */
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

// ─── API response shapes ──────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

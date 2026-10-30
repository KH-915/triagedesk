import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { JwtPayload } from '../types';

const BCRYPT_ROUNDS = 10;

/** Creates a new user account. Throws AppError(409) if the email is already registered. */
export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_CONFLICT', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return prisma.user.create({
    data: { email: input.email, passwordHash },
    select: { id: true, email: true, role: true, createdAt: true },
  });
}

/**
 * Validates credentials and returns a signed JWT + safe user object.
 *
 * Security note: a dummy hash comparison is performed even when the user is not
 * found to prevent timing-based user enumeration.
 */
export async function loginUser(input: LoginInput): Promise<{ token: string; user: object }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Constant-time path: always run bcrypt.compare even for unknown emails
  const dummyHash = '$2b$10$abcdefghijklmnopqrstuuVwxyz0123456789ABCDEFGHIJKLMNOPQR';
  const hashToCheck = user?.passwordHash ?? dummyHash;
  const match = await bcrypt.compare(input.password, hashToCheck);

  if (!user || !match) {
    // Spec §6.2: "the response does not distinguish between 'email not found' and 'wrong password'"
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  return {
    token,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

/** Fetches a user by ID for the /me endpoint. Returns null if not found. */
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, createdAt: true },
  });
}

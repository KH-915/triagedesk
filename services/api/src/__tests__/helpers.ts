/**
 * Shared test utilities.
 *
 * Import from here instead of creating per-test duplicates.
 * All helpers assume that clearDatabase() is called in beforeEach.
 */

import supertest from 'supertest';
import bcrypt from 'bcrypt';
import app from '../app';
import { prisma } from '../lib/prisma';
import { Role } from '@prisma/client';

// Re-export the supertest agent so tests don't need to import app directly
export const api = supertest(app);

// ─── Database helpers ─────────────────────────────────────────

/**
 * Deletes all rows in FK-safe order.
 * Call in beforeEach to start each test with a clean slate.
 */
export async function clearDatabase(): Promise<void> {
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();
}

/** Closes the Prisma connection. Call in afterAll. */
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

// ─── User / auth helpers ──────────────────────────────────────

/** Creates a user directly in the DB (bypasses the API). */
export async function createTestUser(
  email: string,
  password = 'password123',
  role: Role = Role.REQUESTER,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({ data: { email, passwordHash, role } });
}

/**
 * Registers and logs in via the API.
 * Returns the JWT token and the created user's ID.
 */
export async function registerAndLogin(
  email: string,
  password = 'password123',
  role: Role = Role.REQUESTER,
): Promise<{ token: string; userId: string }> {
  const user = await createTestUser(email, password, role);
  const loginRes = await api.post('/api/auth/login').send({ email, password });
  return { token: loginRes.body.token as string, userId: user.id };
}

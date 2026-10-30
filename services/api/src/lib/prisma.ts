import { PrismaClient } from '@prisma/client';
import { config } from '../config';

/**
 * Singleton Prisma client.
 *
 * The global trick prevents creating a new client on every hot-reload
 * in development (ts-node / nodemon re-evaluates modules on change).
 * In production there is no hot-reload, so the singleton is simply
 * the module-level instance.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      config.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

if (config.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

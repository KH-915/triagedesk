/**
 * Dev-only seed: creates one AGENT and one REQUESTER (the register endpoint can
 * only create requesters). Idempotent. Run: npm --workspace=services/api run seed
 * Credentials below are local demo values — never use them in a deployed environment.
 */
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';

const USERS = [
  { email: 'agent@triagedesk.dev', password: 'agent-password', role: Role.AGENT },
  { email: 'requester@triagedesk.dev', password: 'requester-password', role: Role.REQUESTER },
];

async function main(): Promise<void> {
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: { email: u.email, passwordHash: await bcrypt.hash(u.password, 10), role: u.role },
    });
    console.log(`seeded ${u.role}: ${u.email}`);
  }
}

main().finally(() => prisma.$disconnect());

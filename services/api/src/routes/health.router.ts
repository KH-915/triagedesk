import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { checkMlHealth } from '../services/ml.service';

const router = Router();

/**
 * GET /api/health
 *
 * Spec §6.3: Always returns HTTP 200 to avoid tripping load-balancer health checks.
 * The body communicates the actual component state:
 *   status: "ok"       — all components healthy
 *   status: "degraded" — DB ok but ML service unreachable (tickets still work)
 *   status: "error"    — DB unreachable (critical)
 */
router.get('/', async (_req: Request, res: Response) => {
  // Check DB connectivity
  let dbStatus: 'connected' | 'disconnected' = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'disconnected';
  }

  // Check ML service reachability
  const mlReachable = await checkMlHealth();
  const mlStatus = mlReachable ? 'reachable' : 'unreachable';

  const overallStatus =
    dbStatus === 'disconnected' ? 'error' : mlReachable ? 'ok' : 'degraded';

  res.status(200).json({
    status: overallStatus,
    db: dbStatus,
    ml_service: mlStatus,
  });
});

export default router;

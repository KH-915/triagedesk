import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ─── Security headers ─────────────────────────────────────────
// Spec §8.4
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────
// Spec §8.6: explicit origin list; no wildcard on credentialed requests
app.use(
  cors({
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ─── Body parsing ─────────────────────────────────────────────
// Limit payload size to prevent oversized body attacks
app.use(express.json({ limit: '10kb' }));

// ─── Routes ───────────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── 404 fallback for unmatched routes ───────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} does not exist.`,
    },
  });
});

// ─── Global error handler (must be last) ─────────────────────
app.use(errorHandler);

export default app;

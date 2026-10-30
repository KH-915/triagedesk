import { z } from 'zod';

/**
 * Validates and exports all environment variables the API depends on.
 *
 * Fails fast at startup with a clear error message if any required variable
 * is missing or malformed — before the server starts accepting connections.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for adequate security'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  ML_SERVICE_URL: z.string().default('http://localhost:8000'),
  ML_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config = parsed.data;

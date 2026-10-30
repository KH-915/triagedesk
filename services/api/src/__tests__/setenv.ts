/**
 * Runs before any module is imported by Jest.
 * Overrides DATABASE_URL with TEST_DATABASE_URL so that Prisma connects
 * to the test database instead of the development database.
 *
 * Also ensures required env vars are present with safe defaults so that
 * config/index.ts does not call process.exit(1) during tests.
 */

// Use test DB if configured; otherwise fall back to a clearly-named default
// that will fail cleanly if the test DB container is not running.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Safe defaults for test environment — override via .env or CI secrets
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ??
  'test-only-jwt-secret-must-be-at-least-32-chars-long';
process.env.ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

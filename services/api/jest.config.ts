import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // setenv.ts overrides DATABASE_URL before any module is imported
  setupFiles: ['<rootDir>/src/__tests__/setenv.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/server.ts',
    '!src/__tests__/**',
  ],
  // Integration tests hit a real database; allow enough time
  testTimeout: 30000,
};

export default config;

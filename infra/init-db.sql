-- Creates the test database alongside the main triagedesk database.
-- This script runs automatically when the PostgreSQL container first starts.
-- The main database (triagedesk) is already created by POSTGRES_DB env var.

SELECT 'CREATE DATABASE triagedesk_test'
  WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'triagedesk_test'
  )\gexec

export const DATABASE_POOL = {
  MAX_CLIENTS: 10,
  // node:test runs each test file in its own subprocess, each with its own
  // pool — 15+ files x 10 connections can exceed Postgres's max_connections
  // (100 by default) and cause spurious failures under full-suite load.
  // A small per-file cap here keeps total concurrent connections bounded
  // regardless of how many test files exist.
  TEST_MAX_CLIENTS: 3,
  IDLE_TIMEOUT_MS: 30_000,
  CONNECTION_TIMEOUT_MS: 5_000,
  STATEMENT_TIMEOUT_MS: 10_000,
  SLOW_QUERY_THRESHOLD_MS: 200,
};

// Every table stores timestamps in this timezone by convention (see the
// users_and_admins migration, which also sets it as the database default).
export const DB_TIMEZONE = 'Asia/Kolkata';

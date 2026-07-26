export const DATABASE_POOL = {
  MAX_CLIENTS: 10,
  IDLE_TIMEOUT_MS: 30_000,
  CONNECTION_TIMEOUT_MS: 5_000,
  STATEMENT_TIMEOUT_MS: 10_000,
  SLOW_QUERY_THRESHOLD_MS: 200,
};

// Every table stores timestamps in this timezone by convention (see the
// users_and_admins migration, which also sets it as the database default).
export const DB_TIMEZONE = 'Asia/Kolkata';

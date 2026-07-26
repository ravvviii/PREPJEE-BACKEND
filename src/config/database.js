import pg from 'pg';
import { env } from './env.js';
import { DATABASE_POOL, DB_TIMEZONE } from '../constants/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.database.url,
  // Belt-and-suspenders alongside the database-level default (set in the
  // users_and_admins migration): pin every connection to IST via the
  // connection's own startup parameters, applied by Postgres before the
  // connection is usable — NOT a post-connect `client.query('SET ...')`,
  // which would race against the very first real query on that same client
  // (the pool hands the client to its caller as soon as it connects, without
  // waiting for a 'connect' listener's query to finish).
  options: `-c timezone=${DB_TIMEZONE}`,
  max: DATABASE_POOL.MAX_CLIENTS,
  idleTimeoutMillis: DATABASE_POOL.IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DATABASE_POOL.CONNECTION_TIMEOUT_MS,
  statement_timeout: DATABASE_POOL.STATEMENT_TIMEOUT_MS,
});

pool.on('error', (error) => {
  // Fires on idle-client errors (e.g. the DB restarts) — must be handled or
  // an unhandled 'error' event crashes the whole process.
  console.error('[Postgres] Unexpected error on idle client', error.message);
});

export const checkDatabaseConnection = async () => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[Postgres] Connection check failed', error.message);
    return false;
  }
};

export const closeDatabase = () => pool.end();

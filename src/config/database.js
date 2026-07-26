import pg from 'pg';
import { env } from './env.js';
import { DATABASE_POOL, DB_TIMEZONE } from '../constants/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.database.url,
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

// Belt-and-suspenders alongside the database-level default (set in the
// users_and_admins migration): every client this pool hands out is explicitly
// pinned to IST too, regardless of what the connected database's default is.
pool.on('connect', (client) => {
  client.query(`SET timezone = '${DB_TIMEZONE}'`).catch((error) => {
    console.error('[Postgres] Failed to set session timezone', error.message);
  });
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

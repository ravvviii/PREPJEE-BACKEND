import { pool } from '../config/database.js';

// Runs `fn` inside a transaction: BEGIN -> fn(client) -> COMMIT, or
// ROLLBACK + rethrow on any error. `fn` receives the checked-out client and
// must run its queries through it (not the pool), so they land in the same
// transaction.
export const withTransaction = async (fn) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

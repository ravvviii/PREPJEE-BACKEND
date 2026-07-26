import { pool } from '../config/database.js';
import { DATABASE_POOL } from '../constants/index.js';

// Thin wrapper every repository queries through — logs slow queries and
// normalizes pg errors instead of leaking raw driver errors to the service layer.
export const query = async (text, params = []) => {
  const startedAt = Date.now();

  try {
    const result = await pool.query(text, params);
    const durationMs = Date.now() - startedAt;

    if (durationMs > DATABASE_POOL.SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`[DB] Slow query (${durationMs}ms):`, text);
    }

    return result;
  } catch (error) {
    const normalized = new Error(`Database query failed: ${error.message}`);
    normalized.code = error.code;
    normalized.cause = error;
    throw normalized;
  }
};

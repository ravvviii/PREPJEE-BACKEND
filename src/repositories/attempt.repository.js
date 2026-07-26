import { query } from '../utils/db.js';

// Full CRUD lands in Phase 13 — this aggregate read is all Phase 6's profile
// endpoint needs. Returns real zeros until attempts actually exist.
export const getStatsByUserId = async (userId) => {
  const { rows } = await query(
    `SELECT
       COUNT(*)::int AS total_attempts,
       COUNT(*) FILTER (WHERE is_correct)::int AS correct_attempts
     FROM attempts
     WHERE user_id = $1`,
    [userId],
  );
  return rows[0];
};

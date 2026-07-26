import { query } from '../utils/db.js';

// Full CRUD lands in Phase 16 — this read is all Phase 6's profile endpoint needs.
export const findActiveByUserId = async (userId) => {
  const { rows } = await query(
    `SELECT * FROM subscriptions
     WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
     ORDER BY expires_at DESC
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
};

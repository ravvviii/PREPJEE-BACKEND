import { query } from '../utils/db.js';

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

// Only one subscription should ever be "the current one" for a user — this
// runs right before creating a new active row, so there's never ambiguity
// about which is current.
export const expireActiveForUser = async (userId) => {
  await query(
    "UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
};

export const create = async ({ userId, planId, provider, expiresAt }) => {
  const { rows } = await query(
    `INSERT INTO subscriptions (user_id, plan_id, provider, status, expires_at)
     VALUES ($1, $2, $3, 'active', $4)
     RETURNING *`,
    [userId, planId, provider, expiresAt],
  );
  return rows[0];
};

import { query } from '../utils/db.js';

export const create = async ({ userId, tokenHash, expiresAt }) => {
  const { rows } = await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING *',
    [userId, tokenHash, expiresAt],
  );
  return rows[0];
};

export const findByTokenHash = async (tokenHash) => {
  const { rows } = await query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [
    tokenHash,
  ]);
  return rows[0] ?? null;
};

export const revoke = async (id) => {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [id]);
};

export const revokeAllForUser = async (userId) => {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [
    userId,
  ]);
};

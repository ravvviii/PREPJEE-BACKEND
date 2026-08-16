import { query } from '../utils/db.js';

export const invalidateForAdmin = async (adminId) =>
  query(
    `UPDATE admin_password_reset_tokens
     SET used_at = clock_timestamp()
     WHERE admin_id = $1 AND used_at IS NULL`,
    [adminId],
  );

export const create = async ({ adminId, tokenHash, expiresAt }) => {
  const { rows } = await query(
    `INSERT INTO admin_password_reset_tokens (admin_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [adminId, tokenHash, expiresAt],
  );
  return rows[0];
};

export const consume = async (client, tokenHash) => {
  const { rows } = await client.query(
    `UPDATE admin_password_reset_tokens
     SET used_at = clock_timestamp()
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > clock_timestamp()
     RETURNING admin_id`,
    [tokenHash],
  );
  return rows[0] ?? null;
};

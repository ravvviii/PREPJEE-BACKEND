import { query } from '../utils/db.js';

export const create = async ({ phone, codeHash, expiresAt }) => {
  const { rows } = await query(
    'INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, $3) RETURNING *',
    [phone, codeHash, expiresAt],
  );
  return rows[0];
};

// Most recent not-yet-used code for this phone — verify-otp checks this
// row's expiry/attempt_count itself rather than filtering them out here, so
// it can return a specific reason (expired vs too-many-attempts vs no code).
export const findLatestActiveForPhone = async (phone) => {
  const { rows } = await query(
    `SELECT * FROM otp_codes
     WHERE phone = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone],
  );
  return rows[0] ?? null;
};

export const incrementAttempts = async (id) => {
  await query('UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = $1', [id]);
};

export const markUsed = async (id) => {
  await query('UPDATE otp_codes SET used_at = NOW() WHERE id = $1', [id]);
};

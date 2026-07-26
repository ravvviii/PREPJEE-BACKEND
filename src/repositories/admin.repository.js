import { query } from '../utils/db.js';

export const findByEmail = async (email) => {
  const { rows } = await query('SELECT * FROM admins WHERE email = $1 AND deleted_at IS NULL', [
    email,
  ]);
  return rows[0] ?? null;
};

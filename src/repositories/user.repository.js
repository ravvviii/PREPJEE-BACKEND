import { query } from '../utils/db.js';

export const findByPhone = async (phone) => {
  const { rows } = await query('SELECT * FROM users WHERE phone = $1 AND deleted_at IS NULL', [
    phone,
  ]);
  return rows[0] ?? null;
};

export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
  return rows[0] ?? null;
};

export const create = async ({ phone }) => {
  const { rows } = await query('INSERT INTO users (phone) VALUES ($1) RETURNING *', [phone]);
  return rows[0];
};

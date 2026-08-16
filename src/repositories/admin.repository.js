import { query } from '../utils/db.js';

export const findByEmail = async (email) => {
  const { rows } = await query('SELECT * FROM admins WHERE email = $1 AND deleted_at IS NULL', [
    email,
  ]);
  return rows[0] ?? null;
};

export const createSuperAdmin = async ({ name, email, passwordHash }) => {
  const { rows } = await query(
    `INSERT INTO admins (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'super_admin')
     RETURNING id, name, email, role, created_at`,
    [name, email, passwordHash],
  );
  return rows[0];
};

export const updatePassword = async (client, id, passwordHash) => {
  const { rows } = await client.query(
    `UPDATE admins
     SET password_hash = $2
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id, passwordHash],
  );
  return rows[0] ?? null;
};

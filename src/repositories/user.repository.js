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

// Partial update — any field not provided is `undefined`, which COALESCE
// treats as "keep the existing value" (pg maps undefined params to NULL).
export const updateProfile = async (id, { name, email, avatarUrl, classId, targetExamId }) => {
  const { rows } = await query(
    `UPDATE users SET
       name = COALESCE($2, name),
       email = COALESCE($3, email),
       avatar_url = COALESCE($4, avatar_url),
       class_id = COALESCE($5, class_id),
       target_exam_id = COALESCE($6, target_exam_id)
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id, name, email, avatarUrl, classId, targetExamId],
  );
  return rows[0] ?? null;
};

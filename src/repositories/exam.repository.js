import { query } from '../utils/db.js';

// exams have no dedicated CRUD phase in the plan (admin-managed via a
// general lookup-table admin screen) — this lookup validates a profile
// update's targetExamId actually refers to a real exam.
export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM exams WHERE id = $1', [id]);
  return rows[0] ?? null;
};

// Small, static reference set (JEE Main / JEE Advanced) — a plain list is
// enough, no pagination needed.
export const list = async () => {
  const { rows } = await query('SELECT * FROM exams ORDER BY name ASC');
  return rows;
};

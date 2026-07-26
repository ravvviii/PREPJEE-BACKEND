import { query } from '../utils/db.js';

// years has no CRUD phase in the plan (small, static reference set) — this
// lookup is all the Question Module needs, to validate a question's yearId.
export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM years WHERE id = $1', [id]);
  return rows[0] ?? null;
};

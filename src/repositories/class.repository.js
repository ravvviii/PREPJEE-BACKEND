import { query } from '../utils/db.js';

// Full CRUD lands in Phase 8 — this lookup is all Phase 6 needs, to validate
// a profile update's classId actually refers to a real class.
export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM classes WHERE id = $1 AND deleted_at IS NULL', [
    id,
  ]);
  return rows[0] ?? null;
};

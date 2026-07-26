import { query } from '../utils/db.js';

// Fetches `limit + 1` rows so the service layer can tell whether a next page
// exists without a separate COUNT query.
export const findPage = async ({ limit, cursorCreatedAt, cursorId }) => {
  const params = [];
  let whereClause = 'WHERE deleted_at IS NULL';

  if (cursorCreatedAt && cursorId) {
    params.push(cursorCreatedAt, cursorId);
    whereClause += ` AND (created_at, id) > ($${params.length - 1}, $${params.length})`;
  }

  params.push(limit + 1);
  const { rows } = await query(
    `SELECT id, name, created_at, updated_at FROM subjects
     ${whereClause}
     ORDER BY created_at ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
};

export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM subjects WHERE id = $1 AND deleted_at IS NULL', [
    id,
  ]);
  return rows[0] ?? null;
};

export const findByName = async (name) => {
  const { rows } = await query(
    'SELECT * FROM subjects WHERE name = $1 AND deleted_at IS NULL',
    [name],
  );
  return rows[0] ?? null;
};

export const create = async (name) => {
  const { rows } = await query('INSERT INTO subjects (name) VALUES ($1) RETURNING *', [name]);
  return rows[0];
};

export const update = async (id, name) => {
  const { rows } = await query(
    `UPDATE subjects SET name = COALESCE($2, name)
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id, name],
  );
  return rows[0] ?? null;
};

export const softDelete = async (id) => {
  const { rows } = await query(
    `UPDATE subjects SET deleted_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
};

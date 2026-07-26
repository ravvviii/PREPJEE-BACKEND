import { query } from '../utils/db.js';

export const findPage = async ({
  limit,
  cursorCreatedAt,
  cursorId,
  subjectId,
  classId,
  search,
}) => {
  const params = [];
  let whereClause = 'WHERE deleted_at IS NULL';

  if (subjectId) {
    params.push(subjectId);
    whereClause += ` AND subject_id = $${params.length}`;
  }
  if (classId) {
    params.push(classId);
    whereClause += ` AND class_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND name ILIKE $${params.length}`;
  }
  if (cursorCreatedAt && cursorId) {
    params.push(cursorCreatedAt, cursorId);
    whereClause += ` AND (created_at, id) > ($${params.length - 1}, $${params.length})`;
  }

  params.push(limit + 1);
  const { rows } = await query(
    `SELECT id, subject_id, class_id, name, created_at, updated_at FROM chapters
     ${whereClause}
     ORDER BY created_at ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
};

export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM chapters WHERE id = $1 AND deleted_at IS NULL', [
    id,
  ]);
  return rows[0] ?? null;
};

export const findBySubjectClassName = async (subjectId, classId, name) => {
  const { rows } = await query(
    `SELECT * FROM chapters
     WHERE subject_id = $1 AND class_id = $2 AND name = $3 AND deleted_at IS NULL`,
    [subjectId, classId, name],
  );
  return rows[0] ?? null;
};

export const create = async ({ subjectId, classId, name }) => {
  const { rows } = await query(
    'INSERT INTO chapters (subject_id, class_id, name) VALUES ($1, $2, $3) RETURNING *',
    [subjectId, classId, name],
  );
  return rows[0];
};

export const update = async (id, { subjectId, classId, name }) => {
  const { rows } = await query(
    `UPDATE chapters SET
       subject_id = COALESCE($2, subject_id),
       class_id = COALESCE($3, class_id),
       name = COALESCE($4, name)
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id, subjectId, classId, name],
  );
  return rows[0] ?? null;
};

export const softDelete = async (id) => {
  const { rows } = await query(
    `UPDATE chapters SET deleted_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
};

import { query } from '../utils/db.js';

export const findPage = async ({
  limit,
  cursorCreatedAt,
  cursorId,
  subjectId,
  classId,
  search,
  userId,
}) => {
  const params = [];
  let whereClause = 'WHERE c.deleted_at IS NULL';

  if (subjectId) {
    params.push(subjectId);
    whereClause += ` AND c.subject_id = $${params.length}`;
  }
  if (classId) {
    params.push(classId);
    whereClause += ` AND c.class_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND c.name ILIKE $${params.length}`;
  }
  if (cursorCreatedAt && cursorId) {
    params.push(cursorCreatedAt, cursorId);
    whereClause += ` AND (c.created_at, c.id) > ($${params.length - 1}, $${params.length})`;
  }

  params.push(userId ?? null);
  const userIdParam = params.length;
  params.push(limit + 1);
  const { rows } = await query(
    `SELECT c.id, c.subject_id, c.class_id, c.name, c.created_at, c.updated_at,
       COUNT(DISTINCT q.id)::int AS question_count,
       COUNT(DISTINCT a.question_id)::int AS attempted_question_count,
       COUNT(DISTINCT q.id) FILTER (WHERE q.difficulty = 'easy')::int AS easy_count,
       COUNT(DISTINCT q.id) FILTER (WHERE q.difficulty = 'medium')::int AS medium_count,
       COUNT(DISTINCT q.id) FILTER (WHERE q.difficulty = 'hard')::int AS hard_count
     FROM chapters c
     LEFT JOIN questions q
       ON q.chapter_id = c.id AND q.is_published = TRUE AND q.deleted_at IS NULL
     LEFT JOIN attempts a
       ON a.question_id = q.id AND a.user_id = $${userIdParam}
     ${whereClause}
     GROUP BY c.id
     ORDER BY c.created_at ASC, c.id ASC
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

import { query } from '../utils/db.js';

export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM question_sets WHERE id = $1', [id]);
  return rows[0] ?? null;
};

export const list = async ({ subjectId, classId, chapterId, type, examId, isActive = true }) => {
  const params = [];
  let whereClause = 'WHERE 1 = 1';

  if (isActive !== undefined) {
    params.push(isActive);
    whereClause += ` AND is_active = $${params.length}`;
  }
  if (subjectId) {
    params.push(subjectId);
    whereClause += ` AND subject_id = $${params.length}`;
  }
  if (classId) {
    params.push(classId);
    whereClause += ` AND class_id = $${params.length}`;
  }
  if (chapterId) {
    params.push(chapterId);
    whereClause += ` AND chapter_id = $${params.length}`;
  }
  if (type) {
    params.push(type);
    whereClause += ` AND type = $${params.length}::question_set_type`;
  }
  if (examId) {
    params.push(examId);
    whereClause += ` AND exam_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT s.*, (SELECT COUNT(*)::int FROM question_set_items i WHERE i.set_id = s.id) AS question_count
     FROM question_sets s
     ${whereClause}
     ORDER BY s.type ASC, s.order_index ASC, s.created_at ASC`,
    params,
  );
  return rows;
};

export const create = async ({
  subjectId,
  classId,
  chapterId,
  examId,
  type,
  name,
  durationSeconds,
  orderIndex,
  createdBy,
}) => {
  const { rows } = await query(
    `INSERT INTO question_sets
       (subject_id, class_id, chapter_id, exam_id, type, name, duration_seconds, order_index, created_by)
     VALUES ($1, $2, $3, $4, $5::question_set_type, $6, $7, $8, $9)
     RETURNING *`,
    [subjectId, classId, chapterId ?? null, examId ?? null, type, name, durationSeconds, orderIndex ?? 0, createdBy],
  );
  return rows[0];
};

export const addItem = async ({ setId, questionId, orderIndex }) => {
  const { rows } = await query(
    `INSERT INTO question_set_items (set_id, question_id, order_index)
     VALUES ($1, $2, $3)
     ON CONFLICT (set_id, question_id) DO NOTHING
     RETURNING *`,
    [setId, questionId, orderIndex ?? 0],
  );
  return rows[0] ?? null;
};

// Joins straight through to questions — the service layer decides how much
// of each question (e.g. correctness) is safe to expose to the caller.
export const getItemsWithQuestions = async (setId) => {
  const { rows } = await query(
    `SELECT i.order_index, q.*
     FROM question_set_items i
     JOIN questions q ON q.id = i.question_id
     WHERE i.set_id = $1
     ORDER BY i.order_index ASC`,
    [setId],
  );
  return rows;
};

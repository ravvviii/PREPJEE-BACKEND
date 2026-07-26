import { query } from '../utils/db.js';

export const findPage = async ({
  limit,
  cursorCreatedAt,
  cursorId,
  subjectId,
  classId,
  chapterId,
  yearId,
  examId,
  difficulty,
  isPublished,
}) => {
  const params = [];
  let whereClause = 'WHERE deleted_at IS NULL';

  if (isPublished !== undefined) {
    params.push(isPublished);
    whereClause += ` AND is_published = $${params.length}`;
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
  if (yearId) {
    params.push(yearId);
    whereClause += ` AND year_id = $${params.length}`;
  }
  if (examId) {
    params.push(examId);
    whereClause += ` AND exam_id = $${params.length}`;
  }
  if (difficulty) {
    params.push(difficulty);
    whereClause += ` AND difficulty = $${params.length}::difficulty_level`;
  }
  if (cursorCreatedAt && cursorId) {
    params.push(cursorCreatedAt, cursorId);
    whereClause += ` AND (created_at, id) > ($${params.length - 1}, $${params.length})`;
  }

  params.push(limit + 1);
  const { rows } = await query(
    `SELECT * FROM questions
     ${whereClause}
     ORDER BY created_at ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
};

export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM questions WHERE id = $1 AND deleted_at IS NULL', [
    id,
  ]);
  return rows[0] ?? null;
};

export const create = async ({
  subjectId,
  classId,
  chapterId,
  yearId,
  examId,
  difficulty,
  questionText,
  questionImageUrl,
  createdBy,
}) => {
  const { rows } = await query(
    `INSERT INTO questions
       (subject_id, class_id, chapter_id, year_id, exam_id, difficulty, question_text, question_image_url, created_by)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::difficulty_level, 'medium'), $7, $8, $9)
     RETURNING *`,
    [
      subjectId,
      classId,
      chapterId,
      yearId ?? null,
      examId ?? null,
      difficulty ?? null,
      questionText,
      questionImageUrl ?? null,
      createdBy,
    ],
  );
  return rows[0];
};

export const update = async (
  id,
  { subjectId, classId, chapterId, yearId, examId, difficulty, questionText, questionImageUrl },
) => {
  const { rows } = await query(
    `UPDATE questions SET
       subject_id = COALESCE($2, subject_id),
       class_id = COALESCE($3, class_id),
       chapter_id = COALESCE($4, chapter_id),
       year_id = COALESCE($5, year_id),
       exam_id = COALESCE($6, exam_id),
       difficulty = COALESCE($7::difficulty_level, difficulty),
       question_text = COALESCE($8, question_text),
       question_image_url = COALESCE($9, question_image_url)
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id, subjectId, classId, chapterId, yearId, examId, difficulty, questionText, questionImageUrl],
  );
  return rows[0] ?? null;
};

export const softDelete = async (id) => {
  const { rows } = await query(
    `UPDATE questions SET deleted_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
};

export const setPublished = async (id, isPublished) => {
  const { rows } = await query(
    `UPDATE questions SET is_published = $2
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id, isPublished],
  );
  return rows[0] ?? null;
};

import { query } from '../utils/db.js';

export const getSolvedQuestionsCount = async (userId) => {
  const { rows } = await query(
    'SELECT COUNT(DISTINCT question_id)::int AS count FROM attempts WHERE user_id = $1 AND is_correct = TRUE',
    [userId],
  );
  return rows[0].count;
};

export const getAttemptedQuestionsCount = async (userId) => {
  const { rows } = await query(
    'SELECT COUNT(DISTINCT question_id)::int AS count FROM attempts WHERE user_id = $1',
    [userId],
  );
  return rows[0].count;
};

// A chapter counts as "completed" once the user has attempted (not
// necessarily solved) every one of its published questions at least once.
export const getCompletedChapters = async (userId) => {
  const { rows } = await query(
    `WITH chapter_totals AS (
       SELECT chapter_id, COUNT(*)::int AS total_published
       FROM questions
       WHERE is_published = TRUE AND deleted_at IS NULL
       GROUP BY chapter_id
     ),
     user_attempted AS (
       SELECT q.chapter_id, COUNT(DISTINCT a.question_id)::int AS attempted_count
       FROM attempts a
       JOIN questions q ON q.id = a.question_id
       WHERE a.user_id = $1
       GROUP BY q.chapter_id
     )
     SELECT c.id, c.name
     FROM chapters c
     JOIN chapter_totals ct ON ct.chapter_id = c.id
     JOIN user_attempted ua ON ua.chapter_id = c.id
     WHERE c.deleted_at IS NULL AND ua.attempted_count >= ct.total_published
     ORDER BY c.name ASC`,
    [userId],
  );
  return rows;
};

// Denominator for progressPercent — scoped to the user's own class if set,
// otherwise the whole published question bank.
export const getTotalPublishedQuestions = async ({ classId }) => {
  const { rows } = classId
    ? await query(
        'SELECT COUNT(*)::int AS count FROM questions WHERE is_published = TRUE AND deleted_at IS NULL AND class_id = $1',
        [classId],
      )
    : await query(
        'SELECT COUNT(*)::int AS count FROM questions WHERE is_published = TRUE AND deleted_at IS NULL',
      );
  return rows[0].count;
};

export const getStudyHistory = async (userId, limit) => {
  const { rows } = await query(
    `SELECT a.question_id, a.is_correct, a.created_at AS attempted_at, c.name AS chapter_name
     FROM attempts a
     JOIN questions q ON q.id = a.question_id
     JOIN chapters c ON c.id = q.chapter_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
};

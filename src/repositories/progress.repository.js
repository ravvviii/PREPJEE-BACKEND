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

// Scoped to a single chapter — much cheaper than getCompletedChapters above
// when the caller (attempt.service.js) only needs to know about the one
// chapter a just-submitted attempt belongs to, to decide whether to fire
// COMPLETED_CHAPTER.
export const isChapterComplete = async (userId, chapterId) => {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM questions
        WHERE chapter_id = $2 AND is_published = TRUE AND deleted_at IS NULL) AS total_published,
       (SELECT COUNT(DISTINCT a.question_id)::int FROM attempts a
        JOIN questions q ON q.id = a.question_id
        WHERE a.user_id = $1 AND q.chapter_id = $2) AS attempted_count`,
    [userId, chapterId],
  );
  const { total_published: totalPublished, attempted_count: attemptedCount } = rows[0];
  return totalPublished > 0 && attemptedCount >= totalPublished;
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

export const getDailyActivity = async (userId, days = 90) => {
  const { rows } = await query(
    `SELECT DATE(created_at AT TIME ZONE 'UTC') AS activity_date,
       COUNT(*)::int AS attempt_count,
       COUNT(*) FILTER (WHERE is_correct)::int AS correct_count
     FROM attempts
     WHERE user_id = $1 AND created_at >= CURRENT_DATE - ($2::int - 1)
     GROUP BY DATE(created_at AT TIME ZONE 'UTC')
     ORDER BY activity_date ASC`,
    [userId, days],
  );
  return rows;
};

export const getWeakChapters = async (userId, limit = 5) => {
  const { rows } = await query(
    `SELECT c.id, c.name,
       COUNT(*)::int AS total_attempts,
       COUNT(*) FILTER (WHERE a.is_correct)::int AS correct_attempts,
       ROUND(100.0 * COUNT(*) FILTER (WHERE a.is_correct) / COUNT(*))::int AS accuracy_percent
     FROM attempts a
     JOIN questions q ON q.id = a.question_id
     JOIN chapters c ON c.id = q.chapter_id
     WHERE a.user_id = $1 AND c.deleted_at IS NULL
     GROUP BY c.id, c.name
     ORDER BY accuracy_percent ASC, total_attempts DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
};

export const getDifficultyPerformance = async (userId) => {
  const { rows } = await query(
    `SELECT q.difficulty,
       COUNT(*)::int AS total_attempts,
       COUNT(*) FILTER (WHERE a.is_correct)::int AS correct_attempts
     FROM attempts a
     JOIN questions q ON q.id = a.question_id
     WHERE a.user_id = $1
     GROUP BY q.difficulty
     ORDER BY q.difficulty ASC`,
    [userId],
  );
  return rows;
};

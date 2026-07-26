import { query } from '../utils/db.js';

export const getStatsByUserId = async (userId) => {
  const { rows } = await query(
    `SELECT
       COUNT(*)::int AS total_attempts,
       COUNT(*) FILTER (WHERE is_correct)::int AS correct_attempts
     FROM attempts
     WHERE user_id = $1`,
    [userId],
  );
  return rows[0];
};

// Checked before inserting a new attempt — tells the caller whether this is
// the user's first-ever attempt at this question, which matters for
// deciding whether a chapter just became newly "completed" (see
// attempt.service.js / progress.repository.js's isChapterComplete).
export const existsForUserAndQuestion = async (userId, questionId) => {
  const { rows } = await query(
    'SELECT 1 FROM attempts WHERE user_id = $1 AND question_id = $2 LIMIT 1',
    [userId, questionId],
  );
  return rows.length > 0;
};

// No unique constraint on (user_id, question_id) — retries are allowed, so
// this is an append-only log, never an upsert.
export const create = async ({ userId, questionId, selectedOptionId, isCorrect, timeTakenSeconds }) => {
  const { rows } = await query(
    `INSERT INTO attempts (user_id, question_id, selected_option_id, is_correct, time_taken_seconds)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, questionId, selectedOptionId ?? null, isCorrect, timeTakenSeconds ?? null],
  );
  return rows[0];
};

// Aggregate across every user who has ever attempted this question.
export const getQuestionAccuracy = async (questionId) => {
  const { rows } = await query(
    `SELECT
       COUNT(*)::int AS total_attempts,
       COUNT(*) FILTER (WHERE is_correct)::int AS correct_attempts
     FROM attempts
     WHERE question_id = $1`,
    [questionId],
  );
  return rows[0];
};

// Scoped to one user's own attempts within one chapter's questions.
export const getUserChapterAccuracy = async (userId, chapterId) => {
  const { rows } = await query(
    `SELECT
       COUNT(*)::int AS total_attempts,
       COUNT(*) FILTER (WHERE a.is_correct)::int AS correct_attempts
     FROM attempts a
     JOIN questions q ON q.id = a.question_id
     WHERE a.user_id = $1 AND q.chapter_id = $2`,
    [userId, chapterId],
  );
  return rows[0];
};

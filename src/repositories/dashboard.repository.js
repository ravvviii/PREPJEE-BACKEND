import { query } from '../utils/db.js';

export const countUsers = async () => {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM users WHERE deleted_at IS NULL');
  return rows[0].count;
};

export const countPublishedQuestions = async () => {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM questions WHERE is_published = TRUE AND deleted_at IS NULL',
  );
  return rows[0].count;
};

export const countAttempts = async () => {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM attempts');
  return rows[0].count;
};

export const countActiveSubscriptions = async () => {
  const { rows } = await query(
    "SELECT COUNT(*)::int AS count FROM subscriptions WHERE status = 'active'",
  );
  return rows[0].count;
};

// In the smallest currency unit (paise for INR), same as payments.amount —
// left unconverted so the caller can format per their own currency rules.
export const sumRevenue = async () => {
  const { rows } = await query(
    "SELECT COALESCE(SUM(amount), 0)::int AS total FROM payments WHERE status = 'paid'",
  );
  return rows[0].total;
};

export const mostAttemptedQuestions = async (limit) => {
  const { rows } = await query(
    `SELECT q.id, q.question_text, COUNT(a.id)::int AS attempt_count
     FROM questions q
     JOIN attempts a ON a.question_id = q.id
     WHERE q.deleted_at IS NULL
     GROUP BY q.id
     ORDER BY attempt_count DESC, q.id ASC
     LIMIT $1`,
    [limit],
  );
  return rows;
};

// minAttempts filters out chapters with only a handful of attempts, where
// accuracy is noise rather than a signal worth surfacing to an admin.
export const weakestChapters = async (limit, minAttempts) => {
  const { rows } = await query(
    `SELECT c.id, c.name,
            COUNT(a.id)::int AS attempt_count,
            (SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END)::float / COUNT(a.id)::float) AS accuracy
     FROM chapters c
     JOIN questions q ON q.chapter_id = c.id
     JOIN attempts a ON a.question_id = q.id
     WHERE c.deleted_at IS NULL
     GROUP BY c.id
     HAVING COUNT(a.id) >= $2
     ORDER BY accuracy ASC, c.id ASC
     LIMIT $1`,
    [limit, minAttempts],
  );
  return rows;
};

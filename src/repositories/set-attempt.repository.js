import { query } from '../utils/db.js';

export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM set_attempts WHERE id = $1', [id]);
  return rows[0] ?? null;
};

// A set can be retried, but only one in-progress run at a time — resume it
// instead of silently starting a second timer for the same set.
export const findInProgress = async (userId, setId) => {
  const { rows } = await query(
    `SELECT * FROM set_attempts
     WHERE user_id = $1 AND set_id = $2 AND status = 'in_progress'
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId, setId],
  );
  return rows[0] ?? null;
};

export const create = async ({ userId, setId, totalQuestions, expiresAt }) => {
  const { rows } = await query(
    `INSERT INTO set_attempts (user_id, set_id, total_questions, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, setId, totalQuestions, expiresAt],
  );
  return rows[0];
};

export const submit = async (id, { status, correctCount, scorePercent, submittedAt }) => {
  const { rows } = await query(
    `UPDATE set_attempts SET
       status = $2::set_attempt_status,
       correct_count = $3,
       score_percent = $4,
       submitted_at = $5
     WHERE id = $1
     RETURNING *`,
    [id, status, correctCount, scorePercent, submittedAt],
  );
  return rows[0] ?? null;
};

export const insertAnswer = async ({
  setAttemptId,
  questionId,
  selectedOptionId,
  selectedOptionIds,
  numericalAnswer,
  isCorrect,
}) => {
  const { rows } = await query(
    `INSERT INTO set_attempt_answers
       (set_attempt_id, question_id, selected_option_id, selected_option_ids, numerical_answer, is_correct)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (set_attempt_id, question_id) DO UPDATE SET
       selected_option_id = EXCLUDED.selected_option_id,
       selected_option_ids = EXCLUDED.selected_option_ids,
       numerical_answer = EXCLUDED.numerical_answer,
       is_correct = EXCLUDED.is_correct
     RETURNING *`,
    [
      setAttemptId,
      questionId,
      selectedOptionId ?? null,
      selectedOptionIds ?? null,
      numericalAnswer ?? null,
      isCorrect,
    ],
  );
  return rows[0];
};

export const getAnswers = async (setAttemptId) => {
  const { rows } = await query('SELECT * FROM set_attempt_answers WHERE set_attempt_id = $1', [
    setAttemptId,
  ]);
  return rows;
};

// Powers the "Mocks Attempted" dashboard tile — counts each *set*, not each
// retry, so re-attempting the same mock doesn't inflate the number.
export const getMockStatsByUserId = async (userId) => {
  const { rows } = await query(
    `SELECT COUNT(DISTINCT sa.set_id)::int AS attempted_count
     FROM set_attempts sa
     JOIN question_sets s ON s.id = sa.set_id
     WHERE sa.user_id = $1 AND s.type = 'mock' AND sa.status IN ('submitted', 'expired')`,
    [userId],
  );
  return rows[0].attempted_count;
};

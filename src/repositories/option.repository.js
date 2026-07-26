import { query } from '../utils/db.js';

export const findByQuestionId = async (questionId) => {
  const { rows } = await query(
    'SELECT * FROM options WHERE question_id = $1 ORDER BY order_index ASC, created_at ASC',
    [questionId],
  );
  return rows;
};

export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM options WHERE id = $1', [id]);
  return rows[0] ?? null;
};

export const countByQuestionId = async (questionId) => {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM options WHERE question_id = $1',
    [questionId],
  );
  return rows[0].count;
};

export const create = async ({ questionId, optionText, optionImageUrl, isCorrect, orderIndex }) => {
  const { rows } = await query(
    `INSERT INTO options (question_id, option_text, option_image_url, is_correct, order_index)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [questionId, optionText, optionImageUrl ?? null, isCorrect ?? false, orderIndex],
  );
  return rows[0];
};

export const update = async (id, { optionText, optionImageUrl, isCorrect, orderIndex }) => {
  const { rows } = await query(
    `UPDATE options SET
       option_text = COALESCE($2, option_text),
       option_image_url = COALESCE($3, option_image_url),
       is_correct = COALESCE($4, is_correct),
       order_index = COALESCE($5, order_index)
     WHERE id = $1
     RETURNING *`,
    [id, optionText, optionImageUrl, isCorrect, orderIndex],
  );
  return rows[0] ?? null;
};

export const remove = async (id) => {
  const { rows } = await query('DELETE FROM options WHERE id = $1 RETURNING *', [id]);
  return rows[0] ?? null;
};

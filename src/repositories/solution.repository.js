import { query } from '../utils/db.js';

export const findByQuestionId = async (questionId) => {
  const { rows } = await query('SELECT * FROM solutions WHERE question_id = $1', [questionId]);
  return rows[0] ?? null;
};

export const create = async ({ questionId, explanationText, solutionImageUrl }) => {
  const { rows } = await query(
    `INSERT INTO solutions (question_id, explanation_text, solution_image_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [questionId, explanationText, solutionImageUrl ?? null],
  );
  return rows[0];
};

export const update = async (questionId, { explanationText, solutionImageUrl }) => {
  const { rows } = await query(
    `UPDATE solutions SET
       explanation_text = COALESCE($2, explanation_text),
       solution_image_url = COALESCE($3, solution_image_url)
     WHERE question_id = $1
     RETURNING *`,
    [questionId, explanationText, solutionImageUrl],
  );
  return rows[0] ?? null;
};

export const remove = async (questionId) => {
  const { rows } = await query('DELETE FROM solutions WHERE question_id = $1 RETURNING *', [
    questionId,
  ]);
  return rows[0] ?? null;
};

import { query } from '../utils/db.js';

// Idempotent — (user_id, question_id) is unique, so a repeat bookmark is a no-op.
export const create = async (userId, questionId) => {
  await query(
    `INSERT INTO bookmarks (user_id, question_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, question_id) DO NOTHING`,
    [userId, questionId],
  );
};

// Idempotent — deleting a bookmark that doesn't exist just ends in the
// state the caller wanted, so this never needs to report "not found."
export const remove = async (userId, questionId) => {
  await query('DELETE FROM bookmarks WHERE user_id = $1 AND question_id = $2', [
    userId,
    questionId,
  ]);
};

// Filters out questions that were unpublished/soft-deleted after being
// bookmarked — a student should never see a bookmark pointing at something
// they can no longer actually open.
export const findPage = async ({ userId, limit, cursorCreatedAt, cursorId }) => {
  const params = [userId];
  let whereClause = 'WHERE b.user_id = $1 AND q.is_published = TRUE AND q.deleted_at IS NULL';

  if (cursorCreatedAt && cursorId) {
    params.push(cursorCreatedAt, cursorId);
    whereClause += ` AND (b.created_at, b.id) > ($${params.length - 1}, $${params.length})`;
  }

  params.push(limit + 1);
  const { rows } = await query(
    `SELECT b.id, b.created_at, q.id AS question_id, q.question_text, q.difficulty,
       q.chapter_id, c.name AS chapter_name
     FROM bookmarks b
     JOIN questions q ON q.id = b.question_id
     JOIN chapters c ON c.id = q.chapter_id
     ${whereClause}
     ORDER BY b.created_at ASC, b.id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
};

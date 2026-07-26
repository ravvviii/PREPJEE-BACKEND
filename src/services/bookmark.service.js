import * as bookmarkRepository from '../repositories/bookmark.repository.js';
import * as questionRepository from '../repositories/question.repository.js';
import { AppError } from '../utils/app-error.js';
import { decodeCursor, paginate } from '../utils/pagination.js';
import { HTTP_STATUS, PAGINATION } from '../constants/index.js';

const serializeBookmark = (row) => ({
  bookmarkId: row.id,
  questionId: row.question_id,
  questionText: row.question_text,
  difficulty: row.difficulty,
  bookmarkedAt: row.created_at,
});

export const bookmarkQuestion = async (userId, questionId) => {
  const question = await questionRepository.findById(questionId);
  if (!question || !question.is_published) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }
  await bookmarkRepository.create(userId, questionId);
};

export const removeBookmark = async (userId, questionId) => {
  await bookmarkRepository.remove(userId, questionId);
};

export const listBookmarks = async (userId, { limit, cursor }) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const decoded = decodeCursor(cursor);

  const rows = await bookmarkRepository.findPage({
    userId,
    limit: pageSize,
    cursorCreatedAt: decoded?.createdAt,
    cursorId: decoded?.id,
  });

  const { items, nextCursor } = paginate(rows, pageSize);
  return { items: items.map(serializeBookmark), nextCursor };
};

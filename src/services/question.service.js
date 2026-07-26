import * as questionRepository from '../repositories/question.repository.js';
import * as subjectRepository from '../repositories/subject.repository.js';
import * as classRepository from '../repositories/class.repository.js';
import * as chapterRepository from '../repositories/chapter.repository.js';
import * as yearRepository from '../repositories/year.repository.js';
import * as examRepository from '../repositories/exam.repository.js';
import * as optionService from './option.service.js';
import { AppError } from '../utils/app-error.js';
import { trackEvent } from '../modules/analytics/index.js';
import { decodeCursor, paginate } from '../utils/pagination.js';
import { cached, bumpCacheVersion } from '../utils/cache.js';
import { HTTP_STATUS, PAGINATION, AMPLITUDE_EVENTS, CACHE } from '../constants/index.js';

// Only the public, published-questions list is cached — it's the actual hot
// path (every logged-in student hits it). listAllQuestionsForAdmin stays
// uncached: admins need to see a just-created draft immediately, and that
// endpoint's traffic is low enough that caching it wouldn't earn its keep.
const CACHE_NAMESPACE = 'published_questions';

const serializeQuestion = (question) => ({
  id: question.id,
  subjectId: question.subject_id,
  classId: question.class_id,
  chapterId: question.chapter_id,
  yearId: question.year_id,
  examId: question.exam_id,
  difficulty: question.difficulty,
  questionText: question.question_text,
  questionImageUrl: question.question_image_url,
  isPublished: question.is_published,
  createdBy: question.created_by,
  createdAt: question.created_at,
  updatedAt: question.updated_at,
});

const listInternal = async ({ limit, cursor, filters }) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const decoded = decodeCursor(cursor);

  const rows = await questionRepository.findPage({
    limit: pageSize,
    cursorCreatedAt: decoded?.createdAt,
    cursorId: decoded?.id,
    ...filters,
  });

  const { items, nextCursor } = paginate(rows, pageSize);
  return { items: items.map(serializeQuestion), nextCursor };
};

export const listPublishedQuestions = async ({
  limit,
  cursor,
  subjectId,
  classId,
  chapterId,
  yearId,
  examId,
  difficulty,
}) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const cacheKey = [
    pageSize,
    cursor ?? '',
    subjectId ?? '',
    classId ?? '',
    chapterId ?? '',
    yearId ?? '',
    examId ?? '',
    difficulty ?? '',
  ].join(':');

  return cached(CACHE_NAMESPACE, cacheKey, CACHE.QUESTION_LIST_TTL_SECONDS, () =>
    listInternal({
      limit,
      cursor,
      filters: { subjectId, classId, chapterId, yearId, examId, difficulty, isPublished: true },
    }),
  );
};

export const listAllQuestionsForAdmin = async ({
  limit,
  cursor,
  subjectId,
  classId,
  chapterId,
  yearId,
  examId,
  difficulty,
  isPublished,
}) =>
  listInternal({
    limit,
    cursor,
    filters: { subjectId, classId, chapterId, yearId, examId, difficulty, isPublished },
  });

export const getPublishedQuestionById = async (id, userId) => {
  const question = await questionRepository.findById(id);
  if (!question || !question.is_published) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }

  await trackEvent(AMPLITUDE_EVENTS.VIEWED_QUESTION, userId, {
    question_id: question.id,
    subject_id: question.subject_id,
    difficulty: question.difficulty,
  });

  // Never the admin-facing isCorrect flag here — a student shouldn't be able
  // to inspect the answer before submitting.
  const options = await optionService.listOptionsForStudent(id);
  return { ...serializeQuestion(question), options };
};

// Returns the chapter row (if a chapterId was given) so callers can also
// check it actually belongs to the given subject/class.
const assertReferencesExist = async ({ subjectId, classId, chapterId, yearId, examId }) => {
  if (subjectId && !(await subjectRepository.findById(subjectId))) {
    throw new AppError('Subject not found', HTTP_STATUS.BAD_REQUEST, 'SUBJECT_NOT_FOUND');
  }
  if (classId && !(await classRepository.findById(classId))) {
    throw new AppError('Class not found', HTTP_STATUS.BAD_REQUEST, 'CLASS_NOT_FOUND');
  }

  let chapter = null;
  if (chapterId) {
    chapter = await chapterRepository.findById(chapterId);
    if (!chapter) {
      throw new AppError('Chapter not found', HTTP_STATUS.BAD_REQUEST, 'CHAPTER_NOT_FOUND');
    }
  }

  if (yearId && !(await yearRepository.findById(yearId))) {
    throw new AppError('Year not found', HTTP_STATUS.BAD_REQUEST, 'YEAR_NOT_FOUND');
  }
  if (examId && !(await examRepository.findById(examId))) {
    throw new AppError('Exam not found', HTTP_STATUS.BAD_REQUEST, 'EXAM_NOT_FOUND');
  }

  return chapter;
};

const assertChapterMatchesSubjectAndClass = (chapter, subjectId, classId) => {
  if (chapter && (chapter.subject_id !== subjectId || chapter.class_id !== classId)) {
    throw new AppError(
      "The chapter's subject/class does not match the question's subjectId/classId",
      HTTP_STATUS.BAD_REQUEST,
      'CHAPTER_SUBJECT_CLASS_MISMATCH',
    );
  }
};

export const createQuestion = async (createdBy, fields) => {
  const chapter = await assertReferencesExist(fields);
  assertChapterMatchesSubjectAndClass(chapter, fields.subjectId, fields.classId);

  const question = await questionRepository.create({ ...fields, createdBy });
  await bumpCacheVersion(CACHE_NAMESPACE);
  return serializeQuestion(question);
};

export const updateQuestion = async (id, fields) => {
  const existing = await questionRepository.findById(id);
  if (!existing) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }

  const chapter = await assertReferencesExist(fields);
  assertChapterMatchesSubjectAndClass(
    chapter,
    fields.subjectId ?? existing.subject_id,
    fields.classId ?? existing.class_id,
  );

  const question = await questionRepository.update(id, fields);
  await bumpCacheVersion(CACHE_NAMESPACE);
  return serializeQuestion(question);
};

export const deleteQuestion = async (id) => {
  const question = await questionRepository.softDelete(id);
  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }
  await bumpCacheVersion(CACHE_NAMESPACE);
};

export const publishQuestion = async (id) => {
  const question = await questionRepository.setPublished(id, true);
  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }
  await bumpCacheVersion(CACHE_NAMESPACE);
  return serializeQuestion(question);
};

export const unpublishQuestion = async (id) => {
  const question = await questionRepository.setPublished(id, false);
  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }
  await bumpCacheVersion(CACHE_NAMESPACE);
  return serializeQuestion(question);
};

import * as chapterRepository from '../repositories/chapter.repository.js';
import * as subjectRepository from '../repositories/subject.repository.js';
import * as classRepository from '../repositories/class.repository.js';
import { AppError } from '../utils/app-error.js';
import { decodeCursor, paginate } from '../utils/pagination.js';
import { cached, bumpCacheVersion } from '../utils/cache.js';
import { HTTP_STATUS, PAGINATION, CACHE } from '../constants/index.js';

const CACHE_NAMESPACE = 'chapters';

const serializeChapter = (chapter) => ({
  id: chapter.id,
  subjectId: chapter.subject_id,
  classId: chapter.class_id,
  name: chapter.name,
  createdAt: chapter.created_at,
  updatedAt: chapter.updated_at,
  questionCount: chapter.question_count ?? 0,
  attemptedQuestionCount: chapter.attempted_question_count ?? 0,
  progressPercent:
    chapter.question_count > 0
      ? Math.round((chapter.attempted_question_count / chapter.question_count) * 100)
      : 0,
  difficultyCounts: {
    easy: chapter.easy_count ?? 0,
    medium: chapter.medium_count ?? 0,
    hard: chapter.hard_count ?? 0,
  },
});

export const listChapters = async ({ limit, cursor, subjectId, classId, search, userId }) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const cacheKey = [pageSize, cursor ?? '', subjectId ?? '', classId ?? '', search ?? ''].join(':');

  const loadPage = async () => {
    const decoded = decodeCursor(cursor);
    const rows = await chapterRepository.findPage({
      limit: pageSize,
      cursorCreatedAt: decoded?.createdAt,
      cursorId: decoded?.id,
      subjectId,
      classId,
      search,
      userId,
    });

    const { items, nextCursor } = paginate(rows, pageSize);
    return { items: items.map(serializeChapter), nextCursor };
  };

  // Per-user attempt progress changes frequently and must not enter the shared
  // reference-data cache. Public chapter metadata remains cacheable.
  if (userId) return loadPage();
  return cached(CACHE_NAMESPACE, cacheKey, CACHE.REFERENCE_LIST_TTL_SECONDS, loadPage);
};

const assertSubjectAndClassExist = async (subjectId, classId) => {
  if (subjectId && !(await subjectRepository.findById(subjectId))) {
    throw new AppError('Subject not found', HTTP_STATUS.BAD_REQUEST, 'SUBJECT_NOT_FOUND');
  }
  if (classId && !(await classRepository.findById(classId))) {
    throw new AppError('Class not found', HTTP_STATUS.BAD_REQUEST, 'CLASS_NOT_FOUND');
  }
};

export const createChapter = async ({ subjectId, classId, name }) => {
  await assertSubjectAndClassExist(subjectId, classId);

  if (await chapterRepository.findBySubjectClassName(subjectId, classId, name)) {
    throw new AppError(
      'A chapter with this name already exists for this subject and class',
      HTTP_STATUS.CONFLICT,
      'CHAPTER_NAME_TAKEN',
    );
  }

  const chapter = await chapterRepository.create({ subjectId, classId, name });
  await bumpCacheVersion(CACHE_NAMESPACE);
  return serializeChapter(chapter);
};

export const updateChapter = async (id, fields) => {
  const existingChapter = await chapterRepository.findById(id);
  if (!existingChapter) {
    throw new AppError('Chapter not found', HTTP_STATUS.NOT_FOUND, 'CHAPTER_NOT_FOUND');
  }

  await assertSubjectAndClassExist(fields.subjectId, fields.classId);

  const resolvedSubjectId = fields.subjectId ?? existingChapter.subject_id;
  const resolvedClassId = fields.classId ?? existingChapter.class_id;
  const resolvedName = fields.name ?? existingChapter.name;

  const conflict = await chapterRepository.findBySubjectClassName(
    resolvedSubjectId,
    resolvedClassId,
    resolvedName,
  );
  if (conflict && conflict.id !== id) {
    throw new AppError(
      'A chapter with this name already exists for this subject and class',
      HTTP_STATUS.CONFLICT,
      'CHAPTER_NAME_TAKEN',
    );
  }

  const chapter = await chapterRepository.update(id, fields);
  await bumpCacheVersion(CACHE_NAMESPACE);
  return serializeChapter(chapter);
};

export const deleteChapter = async (id) => {
  const chapter = await chapterRepository.softDelete(id);
  if (!chapter) {
    throw new AppError('Chapter not found', HTTP_STATUS.NOT_FOUND, 'CHAPTER_NOT_FOUND');
  }
  await bumpCacheVersion(CACHE_NAMESPACE);
};

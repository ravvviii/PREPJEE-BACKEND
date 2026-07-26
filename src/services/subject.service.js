import * as subjectRepository from '../repositories/subject.repository.js';
import { AppError } from '../utils/app-error.js';
import { decodeCursor, paginate } from '../utils/pagination.js';
import { HTTP_STATUS, PAGINATION } from '../constants/index.js';

const serializeSubject = (subject) => ({
  id: subject.id,
  name: subject.name,
  createdAt: subject.created_at,
  updatedAt: subject.updated_at,
});

export const listSubjects = async ({ limit, cursor }) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const decoded = decodeCursor(cursor);

  const rows = await subjectRepository.findPage({
    limit: pageSize,
    cursorCreatedAt: decoded?.createdAt,
    cursorId: decoded?.id,
  });

  const { items, nextCursor } = paginate(rows, pageSize);
  return { items: items.map(serializeSubject), nextCursor };
};

export const createSubject = async (name) => {
  if (await subjectRepository.findByName(name)) {
    throw new AppError(
      'A subject with this name already exists',
      HTTP_STATUS.CONFLICT,
      'SUBJECT_NAME_TAKEN',
    );
  }
  const subject = await subjectRepository.create(name);
  return serializeSubject(subject);
};

export const updateSubject = async (id, name) => {
  if (name) {
    const existing = await subjectRepository.findByName(name);
    if (existing && existing.id !== id) {
      throw new AppError(
        'A subject with this name already exists',
        HTTP_STATUS.CONFLICT,
        'SUBJECT_NAME_TAKEN',
      );
    }
  }

  const subject = await subjectRepository.update(id, name);
  if (!subject) {
    throw new AppError('Subject not found', HTTP_STATUS.NOT_FOUND, 'SUBJECT_NOT_FOUND');
  }
  return serializeSubject(subject);
};

export const deleteSubject = async (id) => {
  const subject = await subjectRepository.softDelete(id);
  if (!subject) {
    throw new AppError('Subject not found', HTTP_STATUS.NOT_FOUND, 'SUBJECT_NOT_FOUND');
  }
};

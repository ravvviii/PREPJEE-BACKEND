import * as classRepository from '../repositories/class.repository.js';
import { AppError } from '../utils/app-error.js';
import { decodeCursor, paginate } from '../utils/pagination.js';
import { HTTP_STATUS, PAGINATION } from '../constants/index.js';

const serializeClass = (classRow) => ({
  id: classRow.id,
  name: classRow.name,
  createdAt: classRow.created_at,
  updatedAt: classRow.updated_at,
});

export const listClasses = async ({ limit, cursor }) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const decoded = decodeCursor(cursor);

  const rows = await classRepository.findPage({
    limit: pageSize,
    cursorCreatedAt: decoded?.createdAt,
    cursorId: decoded?.id,
  });

  const { items, nextCursor } = paginate(rows, pageSize);
  return { items: items.map(serializeClass), nextCursor };
};

export const createClass = async (name) => {
  if (await classRepository.findByName(name)) {
    throw new AppError(
      'A class with this name already exists',
      HTTP_STATUS.CONFLICT,
      'CLASS_NAME_TAKEN',
    );
  }
  const classRow = await classRepository.create(name);
  return serializeClass(classRow);
};

export const updateClass = async (id, name) => {
  if (name) {
    const existing = await classRepository.findByName(name);
    if (existing && existing.id !== id) {
      throw new AppError(
        'A class with this name already exists',
        HTTP_STATUS.CONFLICT,
        'CLASS_NAME_TAKEN',
      );
    }
  }

  const classRow = await classRepository.update(id, name);
  if (!classRow) {
    throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND, 'CLASS_NOT_FOUND');
  }
  return serializeClass(classRow);
};

export const deleteClass = async (id) => {
  const classRow = await classRepository.softDelete(id);
  if (!classRow) {
    throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND, 'CLASS_NOT_FOUND');
  }
};

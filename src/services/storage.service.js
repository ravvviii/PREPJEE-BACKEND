import { randomUUID } from 'node:crypto';
import * as storageRepository from '../repositories/storage.repository.js';
import { AppError } from '../utils/app-error.js';
import { env } from '../config/env.js';
import { UPLOAD, HTTP_STATUS } from '../constants/index.js';

const resolveFolder = (folder) =>
  Object.values(UPLOAD.FOLDERS).includes(folder) ? folder : UPLOAD.FOLDERS.MISC;

export const uploadImage = async ({ buffer, mimeType, folder }) => {
  if (!UPLOAD.ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new AppError(
      `Unsupported file type: ${mimeType}. Allowed: ${UPLOAD.ALLOWED_MIME_TYPES.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST,
      'UNSUPPORTED_FILE_TYPE',
    );
  }

  if (buffer.length > UPLOAD.MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      `File too large. Max size is ${UPLOAD.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      HTTP_STATUS.BAD_REQUEST,
      'FILE_TOO_LARGE',
    );
  }

  const extension = UPLOAD.EXTENSION_BY_MIME[mimeType];
  const key = `${resolveFolder(folder)}/${randomUUID()}.${extension}`;

  await storageRepository.putObject(key, buffer, mimeType);

  return { key, url: `${env.r2.publicUrl}/${key}` };
};

export const deleteImage = async (key) => {
  await storageRepository.deleteObject(key);
};

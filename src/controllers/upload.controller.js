import * as storageService from '../services/storage.service.js';
import { success } from '../utils/response.js';
import { AppError } from '../utils/app-error.js';
import { HTTP_STATUS } from '../constants/index.js';

export const uploadImage = async (request, reply) => {
  const file = await request.file();
  if (!file) {
    throw new AppError('No file uploaded', HTTP_STATUS.BAD_REQUEST, 'FILE_MISSING');
  }

  const buffer = await file.toBuffer();
  const folder = file.fields?.folder?.value;

  const result = await storageService.uploadImage({ buffer, mimeType: file.mimetype, folder });
  reply.send(success(result));
};

export const deleteImage = async (request, reply) => {
  const { key } = request.body;
  await storageService.deleteImage(key);
  reply.send(success(null));
};

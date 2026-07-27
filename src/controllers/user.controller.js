import * as userService from '../services/user.service.js';
import { success } from '../utils/response.js';
import { AppError } from '../utils/app-error.js';
import { HTTP_STATUS } from '../constants/index.js';

export const getMe = async (request, reply) => {
  const profile = await userService.getProfile(request.user.id);
  reply.send(success(profile));
};

export const updateProfile = async (request, reply) => {
  const profile = await userService.updateProfile(request.user.id, request.body);
  reply.send(success(profile));
};

export const uploadAvatar = async (request, reply) => {
  const file = await request.file();
  if (!file) {
    throw new AppError('No avatar file uploaded', HTTP_STATUS.BAD_REQUEST, 'FILE_MISSING');
  }

  const profile = await userService.uploadAvatar(request.user.id, {
    buffer: await file.toBuffer(),
    mimeType: file.mimetype,
  });
  reply.send(success(profile));
};

import * as userRepository from '../repositories/user.repository.js';
import * as subscriptionRepository from '../repositories/subscription.repository.js';
import * as attemptRepository from '../repositories/attempt.repository.js';
import * as classRepository from '../repositories/class.repository.js';
import * as examRepository from '../repositories/exam.repository.js';
import * as storageService from './storage.service.js';
import { AppError } from '../utils/app-error.js';
import { env } from '../config/env.js';
import { HTTP_STATUS, UPLOAD } from '../constants/index.js';

const serializeProfile = (user, subscription, stats) => ({
  id: user.id,
  phone: user.phone,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatar_url,
  classId: user.class_id,
  targetExamId: user.target_exam_id,
  bucketId: user.bucket_id,
  subscription: {
    status: subscription ? subscription.status : 'none',
    expiresAt: subscription ? subscription.expires_at : null,
  },
  stats: {
    totalAttempts: stats.total_attempts,
    correctAttempts: stats.correct_attempts,
    accuracyPercent:
      stats.total_attempts > 0
        ? Math.round((stats.correct_attempts / stats.total_attempts) * 100)
        : 0,
  },
});

const buildProfile = async (user) => {
  const [subscription, stats] = await Promise.all([
    subscriptionRepository.findActiveByUserId(user.id),
    attemptRepository.getStatsByUserId(user.id),
  ]);
  return serializeProfile(user, subscription, stats);
};

export const getProfile = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND');
  }
  return buildProfile(user);
};

export const updateProfile = async (userId, fields) => {
  if (fields.classId && !(await classRepository.findById(fields.classId))) {
    throw new AppError('Class not found', HTTP_STATUS.BAD_REQUEST, 'CLASS_NOT_FOUND');
  }

  if (fields.targetExamId && !(await examRepository.findById(fields.targetExamId))) {
    throw new AppError('Exam not found', HTTP_STATUS.BAD_REQUEST, 'EXAM_NOT_FOUND');
  }

  const updatedUser = await userRepository.updateProfile(userId, fields);
  if (!updatedUser) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND');
  }

  return buildProfile(updatedUser);
};

const hasValidImageSignature = (buffer, mimeType) => {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP'
    );
  }
  return false;
};

const ownedProfileKeyFromUrl = (url) => {
  if (!url) return null;
  const prefix = `${env.r2.publicUrl.replace(/\/$/, '')}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.startsWith(`${UPLOAD.FOLDERS.PROFILES}/`) ? key : null;
};

export const uploadAvatar = async (userId, { buffer, mimeType }) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND');
  }
  if (!hasValidImageSignature(buffer, mimeType)) {
    throw new AppError(
      'The uploaded file content is not a valid JPEG, PNG, or WebP image',
      HTTP_STATUS.BAD_REQUEST,
      'INVALID_IMAGE_CONTENT',
    );
  }

  const uploaded = await storageService.uploadImage({
    buffer,
    mimeType,
    folder: UPLOAD.FOLDERS.PROFILES,
  });

  let updatedUser;
  try {
    updatedUser = await userRepository.updateProfile(userId, { avatarUrl: uploaded.url });
  } catch (error) {
    await storageService.deleteImage(uploaded.key).catch(() => {});
    throw error;
  }

  const previousKey = ownedProfileKeyFromUrl(user.avatar_url);
  if (previousKey && previousKey !== uploaded.key) {
    await storageService.deleteImage(previousKey).catch(() => {});
  }

  return buildProfile(updatedUser);
};

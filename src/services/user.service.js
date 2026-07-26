import * as userRepository from '../repositories/user.repository.js';
import * as subscriptionRepository from '../repositories/subscription.repository.js';
import * as attemptRepository from '../repositories/attempt.repository.js';
import * as classRepository from '../repositories/class.repository.js';
import * as examRepository from '../repositories/exam.repository.js';
import { AppError } from '../utils/app-error.js';
import { HTTP_STATUS } from '../constants/index.js';

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

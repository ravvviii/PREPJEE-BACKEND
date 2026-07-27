import * as subscriptionPlanRepository from '../repositories/subscription-plan.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { decodeCursor, paginate } from '../utils/pagination.js';
import { HTTP_STATUS, PAGINATION } from '../constants/index.js';

const serializePlan = (plan) => ({
  id: plan.id,
  name: plan.name,
  amount: plan.amount,
  currency: plan.currency,
  durationDays: plan.duration_days,
  isActive: plan.is_active,
  isDefault: plan.is_default,
  bucketMin: plan.bucket_min,
  bucketMax: plan.bucket_max,
});

const assertValidBucketRange = (bucketMin, bucketMax) => {
  if (bucketMin > bucketMax) {
    throw new AppError(
      'Bucket minimum cannot be greater than bucket maximum',
      HTTP_STATUS.BAD_REQUEST,
      'INVALID_BUCKET_RANGE',
    );
  }
};

export const listPlans = async ({ limit, cursor, onlyActive, userId }) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const decoded = decodeCursor(cursor);
  const user = userId ? await userRepository.findById(userId) : null;

  const rows = await subscriptionPlanRepository.findPage({
    limit: pageSize,
    cursorCreatedAt: decoded?.createdAt,
    cursorId: decoded?.id,
    onlyActive,
    bucketId: user?.bucket_id,
  });

  const { items, nextCursor } = paginate(rows, pageSize);
  return { items: items.map(serializePlan), nextCursor };
};

export const createPlan = async (fields) => {
  assertValidBucketRange(fields.bucketMin ?? 0, fields.bucketMax ?? 99);
  if (await subscriptionPlanRepository.findByName(fields.name)) {
    throw new AppError(
      'A plan with this name already exists',
      HTTP_STATUS.CONFLICT,
      'PLAN_NAME_TAKEN',
    );
  }
  const plan = await subscriptionPlanRepository.create(fields);
  return serializePlan(plan);
};

export const updatePlan = async (id, fields) => {
  const current = await subscriptionPlanRepository.findById(id);
  if (!current) {
    throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND, 'PLAN_NOT_FOUND');
  }
  assertValidBucketRange(
    fields.bucketMin ?? current.bucket_min,
    fields.bucketMax ?? current.bucket_max,
  );

  if (fields.name) {
    const existing = await subscriptionPlanRepository.findByName(fields.name);
    if (existing && existing.id !== id) {
      throw new AppError(
        'A plan with this name already exists',
        HTTP_STATUS.CONFLICT,
        'PLAN_NAME_TAKEN',
      );
    }
  }

  const updated = await subscriptionPlanRepository.update(id, fields);
  // Handled separately from the regular field update — setting a default
  // needs the atomic unset-old/set-new transaction in the repository.
  let finalPlan = updated;
  if (fields.isDefault === true) {
    finalPlan = await subscriptionPlanRepository.setAsDefault(id);
  } else if (fields.isDefault === false) {
    finalPlan = await subscriptionPlanRepository.unsetDefault(id);
  }

  return serializePlan(finalPlan);
};

import * as subscriptionPlanRepository from '../repositories/subscription-plan.repository.js';
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
});

export const listPlans = async ({ limit, cursor, onlyActive }) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const decoded = decodeCursor(cursor);

  const rows = await subscriptionPlanRepository.findPage({
    limit: pageSize,
    cursorCreatedAt: decoded?.createdAt,
    cursorId: decoded?.id,
    onlyActive,
  });

  const { items, nextCursor } = paginate(rows, pageSize);
  return { items: items.map(serializePlan), nextCursor };
};

export const createPlan = async (fields) => {
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
  if (!updated) {
    throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND, 'PLAN_NOT_FOUND');
  }

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

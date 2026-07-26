import * as userRepository from '../repositories/user.repository.js';
import * as subscriptionPlanRepository from '../repositories/subscription-plan.repository.js';
import * as subscriptionRepository from '../repositories/subscription.repository.js';
import { AppError } from '../utils/app-error.js';
import { HTTP_STATUS, PAYMENT_PROVIDERS } from '../constants/index.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// planName is optional — falls back to whichever plan is marked as default.
// Deliberately does NOT require the plan to be `isActive` — an admin
// granting/comping access for support reasons is exactly the case where a
// retired plan might still need to be usable.
const resolvePlan = async (planName) => {
  if (planName) {
    const plan = await subscriptionPlanRepository.findByName(planName);
    if (!plan) {
      throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND, 'PLAN_NOT_FOUND');
    }
    return plan;
  }

  const defaultPlan = await subscriptionPlanRepository.findDefault();
  if (!defaultPlan) {
    throw new AppError(
      'No planName was given and no default plan is configured',
      HTTP_STATUS.BAD_REQUEST,
      'NO_DEFAULT_PLAN',
    );
  }
  return defaultPlan;
};

export const grantSubscription = async (phone, planName) => {
  const user = await userRepository.findByPhone(phone);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND');
  }

  const plan = await resolvePlan(planName);

  await subscriptionRepository.expireActiveForUser(user.id);
  const subscription = await subscriptionRepository.create({
    userId: user.id,
    planId: plan.id,
    provider: PAYMENT_PROVIDERS.ADMIN_GRANT,
    expiresAt: new Date(Date.now() + plan.duration_days * MS_PER_DAY),
  });

  return {
    subscriptionId: subscription.id,
    planName: plan.name,
    expiresAt: subscription.expires_at,
  };
};

export const revokeSubscription = async (phone) => {
  const user = await userRepository.findByPhone(phone);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND');
  }

  const active = await subscriptionRepository.findActiveByUserId(user.id);
  if (!active) {
    throw new AppError(
      'This user has no active subscription to revoke',
      HTTP_STATUS.NOT_FOUND,
      'SUBSCRIPTION_NOT_FOUND',
    );
  }

  await subscriptionRepository.expireActiveForUser(user.id);
};

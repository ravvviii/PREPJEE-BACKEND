import { createHmac, timingSafeEqual } from 'node:crypto';
import { razorpayClient } from '../config/razorpay.js';
import { env } from '../config/env.js';
import * as planRepository from '../repositories/subscription-plan.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import * as recurringRepository from '../repositories/recurring-subscription.repository.js';
import { AppError } from '../utils/app-error.js';
import { HTTP_STATUS, PAYMENT_PROVIDERS } from '../constants/index.js';
import { query } from '../utils/db.js';

const SECONDS_PER_DAY = 24 * 60 * 60;

const safeEqual = (expected, actual) => {
  if (!actual || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
};

const assertProviderPlanMatches = async (plan) => {
  let providerPlan;
  try {
    providerPlan = await razorpayClient.plans.fetch(plan.provider_plan_id);
  } catch {
    throw new AppError(
      'The configured Razorpay plan could not be loaded',
      502,
      'PROVIDER_PLAN_UNAVAILABLE',
    );
  }
  const item = providerPlan?.item;
  const matches =
    Number(item?.amount) === plan.amount &&
    item?.currency === plan.currency &&
    providerPlan?.period === plan.billing_period &&
    Number(providerPlan?.interval) === plan.billing_interval;
  if (!matches) {
    throw new AppError(
      'The local plan does not match its Razorpay plan configuration',
      HTTP_STATUS.CONFLICT,
      'PROVIDER_PLAN_MISMATCH',
    );
  }
};

const serializeCheckout = (intent, plan) => ({
  subscriptionId: intent.provider_subscription_id,
  keyId: env.razorpay.keyId,
  trialAmount: intent.trial_applied ? plan.trial_amount : null,
  trialDays: intent.trial_applied ? plan.trial_days : null,
  renewalAmount: plan.amount,
  currency: plan.currency,
  planName: plan.name,
  startAt: intent.start_at,
});

export const createSubscription = async (userId, planId, idempotencyKey) => {
  const [plan, user] = await Promise.all([
    planRepository.findById(planId),
    userRepository.findById(userId),
  ]);
  const eligible =
    plan?.is_active &&
    plan.recurring_enabled &&
    user &&
    user.bucket_id >= plan.bucket_min &&
    user.bucket_id <= plan.bucket_max;
  if (!eligible) {
    throw new AppError('Recurring plan not found', HTTP_STATUS.NOT_FOUND, 'PLAN_NOT_FOUND');
  }

  const existing = await recurringRepository.findIntentByIdempotencyKey(
    userId,
    PAYMENT_PROVIDERS.RAZORPAY,
    idempotencyKey,
  );
  if (existing) {
    if (existing.plan_id !== planId) {
      throw new AppError(
        'This idempotency key was already used for another plan',
        HTTP_STATUS.CONFLICT,
        'IDEMPOTENCY_KEY_REUSED',
      );
    }
    return serializeCheckout(existing, plan);
  }

  await assertProviderPlanMatches(plan);
  const trialApplied =
    Boolean(plan.trial_days) && !(await recurringRepository.hasUsedTrial(userId, planId));
  const startAt =
    Math.floor(Date.now() / 1000) + (trialApplied ? plan.trial_days * SECONDS_PER_DAY : 0);
  const payload = {
    plan_id: plan.provider_plan_id,
    total_count: plan.total_count,
    quantity: 1,
    customer_notify: true,
    notes: { userId, localPlanId: plan.id },
  };
  if (trialApplied) {
    payload.start_at = startAt;
    payload.addons = [
      {
        item: {
          name: `${plan.name} trial`,
          amount: plan.trial_amount,
          currency: plan.currency,
        },
      },
    ];
  }

  const providerSubscription = await razorpayClient.subscriptions.create(payload);
  const intent = await recurringRepository.createIntent({
    userId,
    planId,
    provider: PAYMENT_PROVIDERS.RAZORPAY,
    providerSubscriptionId: providerSubscription.id,
    idempotencyKey,
    startAt: new Date(startAt * 1000),
    trialApplied,
  });
  return serializeCheckout(intent, plan);
};

export const verifySubscription = async (
  userId,
  { razorpayPaymentId, razorpaySubscriptionId, razorpaySignature },
) => {
  const expected = createHmac('sha256', env.razorpay.keySecret)
    .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
    .digest('hex');
  if (!safeEqual(expected, razorpaySignature)) {
    throw new AppError('Invalid subscription signature', 400, 'INVALID_SIGNATURE');
  }

  const intent = await recurringRepository.findIntentByProviderId(
    PAYMENT_PROVIDERS.RAZORPAY,
    razorpaySubscriptionId,
  );
  if (!intent || intent.user_id !== userId) {
    throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
  }
  await recurringRepository.activateSubscription({
    intentId: intent.id,
    paymentId: razorpayPaymentId,
  });
  return { status: 'authenticated' };
};

export const cancelSubscription = async (userId, cancelAtCycleEnd = true) => {
  const { rows } = await query(
    `SELECT provider_subscription_id FROM subscriptions
     WHERE user_id = $1 AND status = 'active' AND provider_subscription_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  const providerSubscriptionId = rows[0]?.provider_subscription_id;
  if (!providerSubscriptionId) {
    throw new AppError('Recurring subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
  }
  await razorpayClient.subscriptions.cancel(providerSubscriptionId, cancelAtCycleEnd);
  return { status: cancelAtCycleEnd ? 'cancel_scheduled' : 'cancelled' };
};

export const handleLifecycleEvent = async (event, parsedBody) => {
  if (!event?.startsWith('subscription.')) return false;
  const entity = parsedBody?.payload?.subscription?.entity;
  if (!entity?.id) return true;
  const statusByEvent = {
    'subscription.authenticated': 'authenticated',
    'subscription.activated': 'active',
    'subscription.charged': 'active',
    'subscription.pending': 'pending',
    'subscription.halted': 'halted',
    'subscription.cancelled': 'cancelled',
    'subscription.completed': 'completed',
  };
  const status = statusByEvent[event];
  if (status) {
    if (
      ['subscription.authenticated', 'subscription.activated', 'subscription.charged'].includes(
        event,
      )
    ) {
      const intent = await recurringRepository.findIntentByProviderId(
        PAYMENT_PROVIDERS.RAZORPAY,
        entity.id,
      );
      if (intent) {
        await recurringRepository.activateSubscription({ intentId: intent.id });
      }
    }
    await recurringRepository.updateLifecycle({
      providerSubscriptionId: entity.id,
      status,
      currentEnd: entity.current_end,
    });
    const payment = parsedBody?.payload?.payment?.entity;
    if (payment) {
      await recurringRepository.recordCharge({
        providerSubscriptionId: entity.id,
        providerPaymentId: payment.id,
        providerOrderId: payment.order_id,
        amount: payment.amount,
        currency: payment.currency,
        event,
      });
    }
  }
  return true;
};

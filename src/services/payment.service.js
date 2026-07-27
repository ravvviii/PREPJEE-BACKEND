import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { razorpayClient } from '../config/razorpay.js';
import { env } from '../config/env.js';
import * as paymentRepository from '../repositories/payment.repository.js';
import * as subscriptionPlanRepository from '../repositories/subscription-plan.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import { handleLifecycleEvent } from './recurring-payment.service.js';
import { AppError } from '../utils/app-error.js';
import { trackEvent } from '../modules/analytics/index.js';
import { decodeCursor, paginate } from '../utils/pagination.js';
import {
  HTTP_STATUS,
  PAGINATION,
  AMPLITUDE_EVENTS,
  PAYMENT_PROVIDERS,
} from '../constants/index.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const serializePayment = (payment) => ({
  id: payment.id,
  amount: payment.amount,
  currency: payment.currency,
  status: payment.status,
  provider: payment.provider,
  createdAt: payment.created_at,
});

// Constant-time comparison — a plain `===` on signatures would leak timing
// information an attacker could use to guess a valid signature byte-by-byte.
const timingSafeEqualHex = (expectedHex, actualHex) => {
  if (!actualHex) return false;
  const expectedBuffer = Buffer.from(expectedHex, 'utf8');
  const actualBuffer = Buffer.from(actualHex, 'utf8');
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
};

const serializeOrder = (payment) => ({
  paymentId: payment.id,
  orderId: payment.provider_order_id,
  amount: payment.amount,
  currency: payment.currency,
  keyId: env.razorpay.keyId,
});

export const createOrder = async (userId, planId, idempotencyKey) => {
  const [plan, user] = await Promise.all([
    subscriptionPlanRepository.findById(planId),
    userRepository.findById(userId),
  ]);
  const eligible =
    plan &&
    user &&
    user.bucket_id >= plan.bucket_min &&
    user.bucket_id <= plan.bucket_max;
  if (!plan || !plan.is_active || !eligible) {
    throw new AppError('Subscription plan not found', HTTP_STATUS.NOT_FOUND, 'PLAN_NOT_FOUND');
  }

  const existing = await paymentRepository.findByIdempotencyKey(
    userId,
    PAYMENT_PROVIDERS.RAZORPAY,
    idempotencyKey,
  );
  if (existing) {
    if (existing.provider_metadata?.planId !== planId) {
      throw new AppError(
        'This idempotency key was already used for another plan',
        HTTP_STATUS.CONFLICT,
        'IDEMPOTENCY_KEY_REUSED',
      );
    }
    if (existing.status !== 'created') {
      throw new AppError(
        'This checkout has already completed',
        HTTP_STATUS.CONFLICT,
        'CHECKOUT_ALREADY_COMPLETED',
      );
    }
    return serializeOrder(existing);
  }

  const order = await razorpayClient.orders.create({
    amount: plan.amount,
    currency: plan.currency,
    // Razorpay caps `receipt` at 40 characters — a bare UUID is 36, leaving
    // no room for a prefix like "receipt_" (would be 44 and get rejected).
    receipt: randomUUID(),
  });

  let payment;
  try {
    payment = await paymentRepository.create({
      userId,
      provider: PAYMENT_PROVIDERS.RAZORPAY,
      providerOrderId: order.id,
      amount: plan.amount,
      currency: plan.currency,
      metadata: { planId: plan.id },
      idempotencyKey,
    });
  } catch (error) {
    // Two tabs can race after both miss the first lookup. The unique index is
    // the final authority: return the winning row instead of writing twice.
    if (error.code !== '23505') throw error;
    payment = await paymentRepository.findByIdempotencyKey(
      userId,
      PAYMENT_PROVIDERS.RAZORPAY,
      idempotencyKey,
    );
    if (!payment) throw error;
  }

  await trackEvent(AMPLITUDE_EVENTS.STARTED_SUBSCRIPTION, userId, {
    plan_id: plan.id,
    amount: plan.amount,
  });

  return serializeOrder(payment);
};

// Shared by both the verify endpoint and the webhook — whichever arrives
// first does the work; the other is a no-op. Guards on 'created' rather than
// just "not yet paid" so a stray webhook can't flip an already-failed
// payment back to paid, or vice versa.
const completePayment = async (payment) => {
  if (payment.status !== 'created') return;

  const planId = payment.provider_metadata?.planId;
  const plan = planId ? await subscriptionPlanRepository.findById(planId) : null;
  if (!plan) {
    throw new AppError(
      'Plan referenced by this payment no longer exists',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'PLAN_NOT_FOUND',
    );
  }

  const completion = await paymentRepository.completeWithSubscription({
    paymentId: payment.id,
    planId: plan.id,
    expiresAt: new Date(Date.now() + plan.duration_days * MS_PER_DAY),
  });
  if (!completion) return;

  await trackEvent(AMPLITUDE_EVENTS.SUCCEEDED_PAYMENT, payment.user_id, {
    payment_id: payment.id,
    plan_id: plan.id,
    amount: payment.amount,
  });
};

export const verifyPayment = async (
  userId,
  { razorpayOrderId, razorpayPaymentId, razorpaySignature },
) => {
  const expectedSignature = createHmac('sha256', env.razorpay.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (!timingSafeEqualHex(expectedSignature, razorpaySignature)) {
    throw new AppError('Invalid payment signature', HTTP_STATUS.BAD_REQUEST, 'INVALID_SIGNATURE');
  }

  const payment = await paymentRepository.findByProviderOrderId(
    PAYMENT_PROVIDERS.RAZORPAY,
    razorpayOrderId,
  );
  if (!payment || payment.user_id !== userId) {
    throw new AppError('Payment not found', HTTP_STATUS.NOT_FOUND, 'PAYMENT_NOT_FOUND');
  }

  await paymentRepository.setProviderPaymentId(payment.id, razorpayPaymentId);
  await completePayment(payment);

  return { status: 'paid' };
};

export const handleWebhook = async (rawBody, signature, parsedBody) => {
  const expectedSignature = createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (!timingSafeEqualHex(expectedSignature, signature)) {
    throw new AppError(
      'Invalid webhook signature',
      HTTP_STATUS.BAD_REQUEST,
      'INVALID_WEBHOOK_SIGNATURE',
    );
  }

  const { event, payload } = parsedBody ?? {};
  if (await handleLifecycleEvent(event, parsedBody)) return;
  const paymentEntity = payload?.payment?.entity;
  if (!paymentEntity) return;

  const payment = await paymentRepository.findByProviderOrderId(
    PAYMENT_PROVIDERS.RAZORPAY,
    paymentEntity.order_id,
  );
  // Unknown order — ignore rather than error. A stray/irrelevant webhook
  // should never surface as a 4xx/5xx to Razorpay's retry logic.
  if (!payment) return;

  if (event === 'payment.captured') {
    await paymentRepository.setProviderPaymentId(payment.id, paymentEntity.id);
    await completePayment(payment);
  } else if (event === 'payment.failed') {
    await paymentRepository.markFailed(payment.id);
  }
};

export const getPaymentHistory = async (userId, { limit, cursor }) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const decoded = decodeCursor(cursor);

  const rows = await paymentRepository.findPageByUserId({
    userId,
    limit: pageSize,
    cursorCreatedAt: decoded?.createdAt,
    cursorId: decoded?.id,
  });

  const { items, nextCursor } = paginate(rows, pageSize);
  return { items: items.map(serializePayment), nextCursor };
};

import { createOrder, verify, webhook, history } from '../controllers/payment.controller.js';
import {
  create as createRecurring,
  verify as verifyRecurring,
  cancel as cancelRecurring,
} from '../controllers/recurring-payment.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export default async function paymentRoutes(fastify) {
  fastify.post(
    '/payments/subscription',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Create a Razorpay recurring subscription with optional trial',
        tags: ['payments'],
        body: {
          type: 'object',
          required: ['planId', 'idempotencyKey'],
          properties: {
            planId: { type: 'string', format: 'uuid' },
            idempotencyKey: { type: 'string', minLength: 16, maxLength: 100 },
          },
          additionalProperties: false,
        },
      },
    },
    createRecurring,
  );

  fastify.post(
    '/payments/subscription/verify',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Verify recurring mandate authorisation',
        tags: ['payments'],
        body: {
          type: 'object',
          required: ['razorpayPaymentId', 'razorpaySubscriptionId', 'razorpaySignature'],
          properties: {
            razorpayPaymentId: { type: 'string' },
            razorpaySubscriptionId: { type: 'string' },
            razorpaySignature: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    verifyRecurring,
  );

  fastify.post(
    '/payments/subscription/cancel',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Cancel recurring billing, at cycle end by default',
        tags: ['payments'],
        body: {
          type: 'object',
          properties: { cancelAtCycleEnd: { type: 'boolean' } },
          additionalProperties: false,
        },
      },
    },
    cancelRecurring,
  );

  fastify.post(
    '/payments/order',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Create a Razorpay order for a subscription plan',
        tags: ['payments'],
        body: {
          type: 'object',
          required: ['planId', 'idempotencyKey'],
          properties: {
            planId: { type: 'string', format: 'uuid' },
            idempotencyKey: { type: 'string', minLength: 16, maxLength: 100 },
          },
          additionalProperties: false,
        },
      },
    },
    createOrder,
  );

  fastify.post(
    '/payments/verify',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Verify a completed Razorpay checkout and activate the subscription',
        tags: ['payments'],
        body: {
          type: 'object',
          required: ['razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature'],
          properties: {
            razorpayOrderId: { type: 'string' },
            razorpayPaymentId: { type: 'string' },
            razorpaySignature: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    verify,
  );

  // No preHandler/auth — Razorpay calls this directly, verified via its own
  // webhook signature (not a user's JWT).
  fastify.post(
    '/payments/webhook',
    {
      schema: {
        description: "Razorpay's async webhook (signature-verified, not user-authenticated)",
        tags: ['payments'],
      },
    },
    webhook,
  );

  fastify.get(
    '/payments/history',
    {
      preHandler: requireAuth,
      schema: {
        description: "The logged-in user's payment history",
        tags: ['payments'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            cursor: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    history,
  );
}

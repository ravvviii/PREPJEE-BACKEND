import { createOrder, verify, webhook, history } from '../controllers/payment.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export default async function paymentRoutes(fastify) {
  fastify.post(
    '/payments/order',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Create a Razorpay order for a subscription plan',
        tags: ['payments'],
        body: {
          type: 'object',
          required: ['planId'],
          properties: { planId: { type: 'string', format: 'uuid' } },
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

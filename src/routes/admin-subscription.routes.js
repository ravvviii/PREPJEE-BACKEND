import { grant, revoke } from '../controllers/admin-subscription.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

export default async function adminSubscriptionRoutes(fastify) {
  fastify.post(
    '/admin/subscriptions/grant',
    {
      preHandler: requireAdminAuth,
      schema: {
        description:
          'Manually grant a subscription plan to a user by phone number. Omit planName to use whichever plan is marked as default.',
        tags: ['admin-subscriptions'],
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string' },
            planName: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    grant,
  );

  fastify.post(
    '/admin/subscriptions/revoke',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: "Revoke a user's active subscription by phone number",
        tags: ['admin-subscriptions'],
        body: {
          type: 'object',
          required: ['phone'],
          properties: { phone: { type: 'string' } },
          additionalProperties: false,
        },
      },
    },
    revoke,
  );
}

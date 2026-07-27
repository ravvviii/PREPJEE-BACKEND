import { create, remove } from '../controllers/internal-subscription.controller.js';
import { requireInternalApiKey } from '../middlewares/internal-api-key.middleware.js';

const requestBodySchema = {
  type: 'object',
  required: ['phone'],
  properties: {
    phone: { type: 'string', minLength: 8, maxLength: 20 },
    planName: { type: 'string', minLength: 1, maxLength: 200 },
  },
  additionalProperties: false,
};

export default async function internalSubscriptionRoutes(fastify) {
  fastify.post(
    '/internal/subscriptions',
    {
      preHandler: requireInternalApiKey,
      schema: {
        description:
          'Grant a subscription by phone for trusted internal automation. Defaults to monthly_999.',
        tags: ['internal-subscriptions'],
        body: requestBodySchema,
      },
    },
    create,
  );

  fastify.delete(
    '/internal/subscriptions',
    {
      preHandler: requireInternalApiKey,
      schema: {
        description: 'Revoke the active subscription for a phone number',
        tags: ['internal-subscriptions'],
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string', minLength: 8, maxLength: 20 },
          },
          additionalProperties: false,
        },
      },
    },
    remove,
  );
}

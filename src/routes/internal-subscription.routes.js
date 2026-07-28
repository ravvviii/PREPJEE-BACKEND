import { create, remove } from '../controllers/internal-subscription.controller.js';
import { requireInternalApiKey } from '../middlewares/internal-api-key.middleware.js';

const requestBodySchema = {
  type: 'object',
  oneOf: [{ required: ['phone'] }, { required: ['email'] }],
  properties: {
    phone: { type: 'string', minLength: 8, maxLength: 20 },
    email: { type: 'string', format: 'email', maxLength: 254 },
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
          'Grant a subscription by phone or email for trusted internal automation. Defaults to monthly_999.',
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
        description: 'Revoke the active subscription for a phone number or email address',
        tags: ['internal-subscriptions'],
        body: {
          type: 'object',
          oneOf: [{ required: ['phone'] }, { required: ['email'] }],
          properties: {
            phone: { type: 'string', minLength: 8, maxLength: 20 },
            email: { type: 'string', format: 'email', maxLength: 254 },
          },
          additionalProperties: false,
        },
      },
    },
    remove,
  );
}

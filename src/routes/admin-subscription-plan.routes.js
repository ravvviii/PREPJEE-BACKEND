import {
  list,
  create,
  update,
} from '../controllers/admin-subscription-plan.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

const planFieldsSchema = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  // Razorpay's own minimum order amount for INR is 100 paise (₹1).
  amount: { type: 'integer', minimum: 100 },
  currency: { type: 'string', minLength: 3, maxLength: 3 },
  durationDays: { type: 'integer', minimum: 1 },
};

export default async function adminSubscriptionPlanRoutes(fastify) {
  fastify.get(
    '/admin/subscription-plans',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'List all subscription plans, active and retired',
        tags: ['admin-subscription-plans'],
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
    list,
  );

  fastify.post(
    '/admin/subscription-plans',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Create a subscription plan',
        tags: ['admin-subscription-plans'],
        body: {
          type: 'object',
          required: ['name', 'amount', 'durationDays'],
          properties: planFieldsSchema,
          additionalProperties: false,
        },
      },
    },
    create,
  );

  fastify.put(
    '/admin/subscription-plans/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description:
          'Update a plan — retire it via isActive: false (no hard delete), or mark it the default via isDefault: true (unsets any other default automatically)',
        tags: ['admin-subscription-plans'],
        params: idParamSchema,
        body: {
          type: 'object',
          properties: {
            ...planFieldsSchema,
            isActive: { type: 'boolean' },
            isDefault: { type: 'boolean' },
          },
          additionalProperties: false,
        },
      },
    },
    update,
  );
}

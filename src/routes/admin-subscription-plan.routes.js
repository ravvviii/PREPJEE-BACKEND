import {
  list,
  create,
  update,
  createProviderPlan,
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
  bucketMin: { type: 'integer', minimum: 0, maximum: 99 },
  bucketMax: { type: 'integer', minimum: 0, maximum: 99 },
  recurringEnabled: { type: 'boolean' },
  billingPeriod: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly'] },
  billingInterval: { type: 'integer', minimum: 1, maximum: 365 },
  totalCount: { type: 'integer', minimum: 1, maximum: 1200 },
  trialAmount: { type: 'integer', minimum: 100 },
  trialDays: { type: 'integer', minimum: 1, maximum: 365 },
  providerPlanId: { type: 'string', minLength: 6, maxLength: 100 },
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

  fastify.post(
    '/admin/subscription-plans/razorpay-plan',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Create a matching recurring plan on Razorpay and return its plan ID',
        tags: ['admin-subscription-plans'],
        body: {
          type: 'object',
          required: ['name', 'amount', 'currency', 'billingPeriod', 'billingInterval'],
          properties: {
            name: planFieldsSchema.name,
            amount: planFieldsSchema.amount,
            currency: planFieldsSchema.currency,
            billingPeriod: planFieldsSchema.billingPeriod,
            billingInterval: planFieldsSchema.billingInterval,
          },
          additionalProperties: false,
        },
      },
    },
    createProviderPlan,
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

import { list, create, update, remove } from '../controllers/admin-option.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

const questionIdParamSchema = {
  type: 'object',
  required: ['questionId'],
  properties: { questionId: { type: 'string', format: 'uuid' } },
};

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

const optionFieldsSchema = {
  optionText: { type: 'string', minLength: 1 },
  optionImageUrl: { type: 'string', format: 'uri' },
  isCorrect: { type: 'boolean' },
  orderIndex: { type: 'integer', minimum: 0 },
};

export default async function adminOptionRoutes(fastify) {
  fastify.get(
    '/admin/questions/:questionId/options',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'List all options for a question, including isCorrect',
        tags: ['admin-options'],
        params: questionIdParamSchema,
      },
    },
    list,
  );

  fastify.post(
    '/admin/questions/:questionId/options',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Add an option to a question',
        tags: ['admin-options'],
        params: questionIdParamSchema,
        body: {
          type: 'object',
          required: ['optionText'],
          properties: optionFieldsSchema,
          additionalProperties: false,
        },
      },
    },
    create,
  );

  fastify.put(
    '/admin/options/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Update an option',
        tags: ['admin-options'],
        params: idParamSchema,
        body: { type: 'object', properties: optionFieldsSchema, additionalProperties: false },
      },
    },
    update,
  );

  fastify.delete(
    '/admin/options/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Delete an option',
        tags: ['admin-options'],
        params: idParamSchema,
      },
    },
    remove,
  );
}

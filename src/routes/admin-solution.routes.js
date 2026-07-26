import { get, create, update, remove } from '../controllers/admin-solution.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

const questionIdParamSchema = {
  type: 'object',
  required: ['questionId'],
  properties: { questionId: { type: 'string', format: 'uuid' } },
};

const solutionFieldsSchema = {
  explanationText: { type: 'string', minLength: 1 },
  solutionImageUrl: { type: 'string', format: 'uri' },
};

export default async function adminSolutionRoutes(fastify) {
  fastify.get(
    '/admin/questions/:questionId/solution',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: "Get a question's solution",
        tags: ['admin-solutions'],
        params: questionIdParamSchema,
      },
    },
    get,
  );

  fastify.post(
    '/admin/questions/:questionId/solution',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Create the solution for a question (one per question)',
        tags: ['admin-solutions'],
        params: questionIdParamSchema,
        body: {
          type: 'object',
          required: ['explanationText'],
          properties: solutionFieldsSchema,
          additionalProperties: false,
        },
      },
    },
    create,
  );

  fastify.put(
    '/admin/questions/:questionId/solution',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: "Update a question's solution",
        tags: ['admin-solutions'],
        params: questionIdParamSchema,
        body: {
          type: 'object',
          properties: solutionFieldsSchema,
          additionalProperties: false,
        },
      },
    },
    update,
  );

  fastify.delete(
    '/admin/questions/:questionId/solution',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: "Delete a question's solution",
        tags: ['admin-solutions'],
        params: questionIdParamSchema,
      },
    },
    remove,
  );
}

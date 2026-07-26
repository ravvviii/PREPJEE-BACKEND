import { submit, questionAccuracy, chapterAccuracy } from '../controllers/attempt.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

export default async function attemptRoutes(fastify) {
  fastify.post(
    '/questions/:id/attempts',
    {
      preHandler: requireAuth,
      schema: {
        description: "Submit an answer to a question — returns correctness, the correct option(s), and the explanation if one exists",
        tags: ['attempts'],
        params: idParamSchema,
        body: {
          type: 'object',
          properties: {
            selectedOptionId: { type: 'string', format: 'uuid' },
            timeTakenSeconds: { type: 'integer', minimum: 0 },
          },
          additionalProperties: false,
        },
      },
    },
    submit,
  );

  fastify.get(
    '/questions/:id/accuracy',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Aggregate accuracy across every attempt on this question, by all users',
        tags: ['attempts'],
        params: idParamSchema,
      },
    },
    questionAccuracy,
  );

  fastify.get(
    '/chapters/:id/accuracy',
    {
      preHandler: requireAuth,
      schema: {
        description: "The logged-in user's own accuracy within this chapter",
        tags: ['attempts'],
        params: idParamSchema,
      },
    },
    chapterAccuracy,
  );
}

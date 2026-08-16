import { start, submit, getResult } from '../controllers/set-attempt.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

const answerSchema = {
  type: 'object',
  required: ['questionId'],
  properties: {
    questionId: { type: 'string', format: 'uuid' },
    selectedOptionId: { type: 'string', format: 'uuid' },
    selectedOptionIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
    numericalAnswer: { type: 'number' },
  },
  additionalProperties: false,
};

export default async function setAttemptRoutes(fastify) {
  fastify.post(
    '/question-sets/:id/attempts',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Start (or resume the in-progress run of) a practice set / mock exam — returns the timer and every question',
        tags: ['question-sets'],
        params: idParamSchema,
      },
    },
    start,
  );

  fastify.post(
    '/set-attempts/:id/submit',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Submit every answer for a set attempt at once — grades everything and returns per-question results',
        tags: ['question-sets'],
        params: idParamSchema,
        body: {
          type: 'object',
          required: ['answers'],
          properties: {
            answers: { type: 'array', items: answerSchema },
          },
          additionalProperties: false,
        },
      },
    },
    submit,
  );

  fastify.get(
    '/set-attempts/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get the summary (score, status, timing) of a set attempt',
        tags: ['question-sets'],
        params: idParamSchema,
      },
    },
    getResult,
  );
}

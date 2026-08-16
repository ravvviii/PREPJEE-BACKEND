import { list } from '../controllers/question-set.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export default async function questionSetRoutes(fastify) {
  fastify.get(
    '/question-sets',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'List practice sets and mock exams, filterable by subject/class/chapter/exam type',
        tags: ['question-sets'],
        querystring: {
          type: 'object',
          properties: {
            subjectId: { type: 'string', format: 'uuid' },
            classId: { type: 'string', format: 'uuid' },
            chapterId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['practice', 'mock'] },
            examId: { type: 'string', format: 'uuid' },
          },
          additionalProperties: false,
        },
      },
    },
    list,
  );
}

import { list, getById } from '../controllers/question.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const filterQuerystring = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    cursor: { type: 'string' },
    subjectId: { type: 'string', format: 'uuid' },
    classId: { type: 'string', format: 'uuid' },
    chapterId: { type: 'string', format: 'uuid' },
    yearId: { type: 'string', format: 'uuid' },
    examId: { type: 'string', format: 'uuid' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
  },
  additionalProperties: false,
};

// Requires login — unlike Subjects/Classes/Chapters, real exam questions are
// the actual product, not open reference data.
export default async function questionRoutes(fastify) {
  fastify.get(
    '/questions',
    {
      preHandler: requireAuth,
      schema: {
        description: 'List published questions (cursor-paginated, filterable)',
        tags: ['questions'],
        querystring: filterQuerystring,
      },
    },
    list,
  );

  fastify.get(
    '/questions/:id',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get a published question by id (fires VIEWED_QUESTION)',
        tags: ['questions'],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    getById,
  );
}

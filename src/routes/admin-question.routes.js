import {
  list,
  create,
  update,
  remove,
  publish,
  unpublish,
} from '../controllers/admin-question.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

const questionFieldsSchema = {
  subjectId: { type: 'string', format: 'uuid' },
  classId: { type: 'string', format: 'uuid' },
  chapterId: { type: 'string', format: 'uuid' },
  yearId: { type: 'string', format: 'uuid' },
  examId: { type: 'string', format: 'uuid' },
  difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
  questionText: { type: 'string', minLength: 1 },
  questionImageUrl: { type: 'string', format: 'uri' },
};

export default async function adminQuestionRoutes(fastify) {
  fastify.get(
    '/admin/questions',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'List all questions, published or draft (filterable)',
        tags: ['admin-questions'],
        querystring: {
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
            isPublished: { type: 'string', enum: ['true', 'false'] },
          },
          additionalProperties: false,
        },
      },
    },
    list,
  );

  fastify.post(
    '/admin/questions',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Create a question as a draft (not visible to students until published)',
        tags: ['admin-questions'],
        body: {
          type: 'object',
          required: ['subjectId', 'classId', 'chapterId', 'questionText'],
          properties: questionFieldsSchema,
          additionalProperties: false,
        },
      },
    },
    create,
  );

  fastify.put(
    '/admin/questions/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Update a question (does not change published status)',
        tags: ['admin-questions'],
        params: idParamSchema,
        body: { type: 'object', properties: questionFieldsSchema, additionalProperties: false },
      },
    },
    update,
  );

  fastify.delete(
    '/admin/questions/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Soft-delete a question',
        tags: ['admin-questions'],
        params: idParamSchema,
      },
    },
    remove,
  );

  fastify.post(
    '/admin/questions/:id/publish',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Publish a question, making it visible to students',
        tags: ['admin-questions'],
        params: idParamSchema,
      },
    },
    publish,
  );

  fastify.post(
    '/admin/questions/:id/unpublish',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Unpublish a question, hiding it from students',
        tags: ['admin-questions'],
        params: idParamSchema,
      },
    },
    unpublish,
  );
}

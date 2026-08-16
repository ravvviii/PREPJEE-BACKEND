import { list } from '../controllers/exam.controller.js';

// Public — exams (JEE Main / JEE Advanced) are non-sensitive reference data,
// needed by the client to render exam-type filters before login.
export default async function examRoutes(fastify) {
  fastify.get(
    '/exams',
    {
      schema: {
        description: 'List exams (JEE Main / JEE Advanced)',
        tags: ['exams'],
      },
    },
    list,
  );
}

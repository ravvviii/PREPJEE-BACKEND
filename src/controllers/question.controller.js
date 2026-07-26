import * as questionService from '../services/question.service.js';
import { success } from '../utils/response.js';

export const list = async (request, reply) => {
  const { limit, cursor, subjectId, classId, chapterId, yearId, examId, difficulty } =
    request.query;
  const result = await questionService.listPublishedQuestions({
    limit: limit ? Number(limit) : undefined,
    cursor,
    subjectId,
    classId,
    chapterId,
    yearId,
    examId,
    difficulty,
  });
  reply.send(success(result));
};

export const getById = async (request, reply) => {
  const question = await questionService.getPublishedQuestionById(
    request.params.id,
    request.user.id,
  );
  reply.send(success(question));
};

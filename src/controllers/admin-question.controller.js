import * as questionService from '../services/question.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const list = async (request, reply) => {
  const {
    limit,
    cursor,
    subjectId,
    classId,
    chapterId,
    yearId,
    examId,
    difficulty,
    isPublished,
  } = request.query;
  const result = await questionService.listAllQuestionsForAdmin({
    limit: limit ? Number(limit) : undefined,
    cursor,
    subjectId,
    classId,
    chapterId,
    yearId,
    examId,
    difficulty,
    isPublished: isPublished === undefined ? undefined : isPublished === 'true',
  });
  reply.send(success(result));
};

export const create = async (request, reply) => {
  const question = await questionService.createQuestion(request.admin.id, request.body);
  reply.status(HTTP_STATUS.CREATED).send(success(question));
};

export const update = async (request, reply) => {
  const question = await questionService.updateQuestion(request.params.id, request.body);
  reply.send(success(question));
};

export const remove = async (request, reply) => {
  await questionService.deleteQuestion(request.params.id);
  reply.send(success(null));
};

export const publish = async (request, reply) => {
  const question = await questionService.publishQuestion(request.params.id);
  reply.send(success(question));
};

export const unpublish = async (request, reply) => {
  const question = await questionService.unpublishQuestion(request.params.id);
  reply.send(success(question));
};

import * as attemptService from '../services/attempt.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const submit = async (request, reply) => {
  const result = await attemptService.submitAnswer(
    request.user.id,
    request.params.id,
    request.body,
  );
  reply.status(HTTP_STATUS.CREATED).send(success(result));
};

export const questionAccuracy = async (request, reply) => {
  const result = await attemptService.getQuestionAccuracy(request.params.id);
  reply.send(success(result));
};

export const chapterAccuracy = async (request, reply) => {
  const result = await attemptService.getUserChapterAccuracy(request.user.id, request.params.id);
  reply.send(success(result));
};

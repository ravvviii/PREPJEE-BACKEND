import * as setAttemptService from '../services/set-attempt.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const start = async (request, reply) => {
  const result = await setAttemptService.startAttempt(request.user.id, request.params.id);
  reply.status(HTTP_STATUS.CREATED).send(success(result));
};

export const submit = async (request, reply) => {
  const result = await setAttemptService.submitAttempt(
    request.user.id,
    request.params.id,
    request.body.answers,
  );
  reply.send(success(result));
};

export const getResult = async (request, reply) => {
  const result = await setAttemptService.getAttemptResult(request.user.id, request.params.id);
  reply.send(success(result));
};

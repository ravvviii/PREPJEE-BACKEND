import * as optionService from '../services/option.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const list = async (request, reply) => {
  const options = await optionService.listOptionsForAdmin(request.params.questionId);
  reply.send(success(options));
};

export const create = async (request, reply) => {
  const option = await optionService.createOption(request.params.questionId, request.body);
  reply.status(HTTP_STATUS.CREATED).send(success(option));
};

export const update = async (request, reply) => {
  const option = await optionService.updateOption(request.params.id, request.body);
  reply.send(success(option));
};

export const remove = async (request, reply) => {
  await optionService.deleteOption(request.params.id);
  reply.send(success(null));
};

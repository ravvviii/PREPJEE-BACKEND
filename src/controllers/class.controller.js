import * as classService from '../services/class.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const list = async (request, reply) => {
  const { limit, cursor } = request.query;
  const result = await classService.listClasses({
    limit: limit ? Number(limit) : undefined,
    cursor,
  });
  reply.send(success(result));
};

export const create = async (request, reply) => {
  const classRow = await classService.createClass(request.body.name);
  reply.status(HTTP_STATUS.CREATED).send(success(classRow));
};

export const update = async (request, reply) => {
  const classRow = await classService.updateClass(request.params.id, request.body.name);
  reply.send(success(classRow));
};

export const remove = async (request, reply) => {
  await classService.deleteClass(request.params.id);
  reply.send(success(null));
};

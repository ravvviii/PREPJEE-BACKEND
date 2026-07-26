import * as subjectService from '../services/subject.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const list = async (request, reply) => {
  const { limit, cursor } = request.query;
  const result = await subjectService.listSubjects({
    limit: limit ? Number(limit) : undefined,
    cursor,
  });
  reply.send(success(result));
};

export const create = async (request, reply) => {
  const subject = await subjectService.createSubject(request.body.name);
  reply.status(HTTP_STATUS.CREATED).send(success(subject));
};

export const update = async (request, reply) => {
  const subject = await subjectService.updateSubject(request.params.id, request.body.name);
  reply.send(success(subject));
};

export const remove = async (request, reply) => {
  await subjectService.deleteSubject(request.params.id);
  reply.send(success(null));
};

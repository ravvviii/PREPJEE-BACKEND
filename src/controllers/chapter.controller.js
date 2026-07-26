import * as chapterService from '../services/chapter.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const list = async (request, reply) => {
  const { limit, cursor, subjectId, classId, search } = request.query;
  const result = await chapterService.listChapters({
    limit: limit ? Number(limit) : undefined,
    cursor,
    subjectId,
    classId,
    search,
  });
  reply.send(success(result));
};

export const create = async (request, reply) => {
  const chapter = await chapterService.createChapter(request.body);
  reply.status(HTTP_STATUS.CREATED).send(success(chapter));
};

export const update = async (request, reply) => {
  const chapter = await chapterService.updateChapter(request.params.id, request.body);
  reply.send(success(chapter));
};

export const remove = async (request, reply) => {
  await chapterService.deleteChapter(request.params.id);
  reply.send(success(null));
};

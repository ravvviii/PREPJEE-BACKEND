import * as bookmarkService from '../services/bookmark.service.js';
import { success } from '../utils/response.js';

export const add = async (request, reply) => {
  await bookmarkService.bookmarkQuestion(request.user.id, request.params.id);
  reply.send(success(null));
};

export const remove = async (request, reply) => {
  await bookmarkService.removeBookmark(request.user.id, request.params.id);
  reply.send(success(null));
};

export const list = async (request, reply) => {
  const { limit, cursor } = request.query;
  const result = await bookmarkService.listBookmarks(request.user.id, {
    limit: limit ? Number(limit) : undefined,
    cursor,
  });
  reply.send(success(result));
};

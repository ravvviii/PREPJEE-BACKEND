import * as adminUserService from '../services/admin-user.service.js';
import { success } from '../utils/response.js';

export const list = async (request, reply) => {
  const { limit, cursor, search } = request.query;
  const result = await adminUserService.listUsers({ limit, cursor, search });
  reply.send(success(result.items, { nextCursor: result.nextCursor }));
};

export const suspend = async (request, reply) => {
  const user = await adminUserService.suspendUser(request.params.id);
  reply.send(success(user));
};

export const unsuspend = async (request, reply) => {
  const user = await adminUserService.unsuspendUser(request.params.id);
  reply.send(success(user));
};

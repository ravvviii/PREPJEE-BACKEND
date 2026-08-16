import * as authService from '../services/auth.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const createSuperAdmin = async (request, reply) => {
  const admin = await authService.createSuperAdmin(request.body);
  reply.status(HTTP_STATUS.CREATED).send(success({ admin }));
};

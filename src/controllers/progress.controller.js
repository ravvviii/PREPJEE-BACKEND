import * as progressService from '../services/progress.service.js';
import { success } from '../utils/response.js';

export const get = async (request, reply) => {
  const progress = await progressService.getProgress(request.user.id);
  reply.send(success(progress));
};

import * as adminDashboardService from '../services/admin-dashboard.service.js';
import { success } from '../utils/response.js';

export const stats = async (request, reply) => {
  const data = await adminDashboardService.getStats();
  reply.send(success(data));
};

export const mostAttemptedQuestions = async (request, reply) => {
  const data = await adminDashboardService.getMostAttemptedQuestions(request.query);
  reply.send(success(data));
};

export const weakestChapters = async (request, reply) => {
  const data = await adminDashboardService.getWeakestChapters(request.query);
  reply.send(success(data));
};

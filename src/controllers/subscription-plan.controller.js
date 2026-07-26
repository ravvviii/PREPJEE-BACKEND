import * as subscriptionPlanService from '../services/subscription-plan.service.js';
import { success } from '../utils/response.js';

export const list = async (request, reply) => {
  const { limit, cursor } = request.query;
  const result = await subscriptionPlanService.listPlans({
    limit: limit ? Number(limit) : undefined,
    cursor,
    onlyActive: true,
  });
  reply.send(success(result));
};

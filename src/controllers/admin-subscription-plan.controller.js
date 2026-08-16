import * as subscriptionPlanService from '../services/subscription-plan.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const list = async (request, reply) => {
  const { limit, cursor } = request.query;
  const result = await subscriptionPlanService.listPlans({
    limit: limit ? Number(limit) : undefined,
    cursor,
    onlyActive: false,
  });
  reply.send(success(result));
};

export const create = async (request, reply) => {
  const plan = await subscriptionPlanService.createPlan(request.body);
  reply.status(HTTP_STATUS.CREATED).send(success(plan));
};

export const update = async (request, reply) => {
  const plan = await subscriptionPlanService.updatePlan(request.params.id, request.body);
  reply.send(success(plan));
};

export const createProviderPlan = async (request, reply) => {
  const result = await subscriptionPlanService.createProviderPlan(request.body);
  reply.status(HTTP_STATUS.CREATED).send(success(result));
};

import * as recurringPaymentService from '../services/recurring-payment.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const create = async (request, reply) => {
  const result = await recurringPaymentService.createSubscription(
    request.user.id,
    request.body.planId,
    request.body.idempotencyKey,
  );
  reply.status(HTTP_STATUS.CREATED).send(success(result));
};

export const verify = async (request, reply) => {
  const result = await recurringPaymentService.verifySubscription(request.user.id, request.body);
  reply.send(success(result));
};

export const cancel = async (request, reply) => {
  const result = await recurringPaymentService.cancelSubscription(
    request.user.id,
    request.body?.cancelAtCycleEnd ?? true,
  );
  reply.send(success(result));
};

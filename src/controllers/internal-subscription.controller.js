import * as adminSubscriptionService from '../services/admin-subscription.service.js';
import { success } from '../utils/response.js';

const DEFAULT_INTERNAL_PLAN = 'monthly_999';

export const create = async (request, reply) => {
  const result = await adminSubscriptionService.grantSubscription(
    { phone: request.body.phone, email: request.body.email },
    request.body.planName || DEFAULT_INTERNAL_PLAN,
  );
  reply.send(success(result));
};

export const remove = async (request, reply) => {
  await adminSubscriptionService.revokeSubscription({
    phone: request.body.phone,
    email: request.body.email,
  });
  reply.send(success(null));
};

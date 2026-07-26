import * as adminSubscriptionService from '../services/admin-subscription.service.js';
import { success } from '../utils/response.js';

export const grant = async (request, reply) => {
  const result = await adminSubscriptionService.grantSubscription(
    request.body.phone,
    request.body.planName,
  );
  reply.send(success(result));
};

export const revoke = async (request, reply) => {
  await adminSubscriptionService.revokeSubscription(request.body.phone);
  reply.send(success(null));
};

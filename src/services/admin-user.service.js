import * as userRepository from '../repositories/user.repository.js';
import * as refreshTokenRepository from '../repositories/refresh-token.repository.js';
import { AppError } from '../utils/app-error.js';
import { decodeCursor, paginate } from '../utils/pagination.js';
import { trackEvent } from '../modules/analytics/index.js';
import { HTTP_STATUS, PAGINATION, AMPLITUDE_EVENTS } from '../constants/index.js';

const serializeUser = (user) => ({
  id: user.id,
  phone: user.phone,
  name: user.name,
  email: user.email,
  bucketId: user.bucket_id,
  suspendedAt: user.suspended_at,
  createdAt: user.created_at,
});

export const listUsers = async ({ limit, cursor, search }) => {
  const pageSize = Math.min(limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const decoded = decodeCursor(cursor);

  const rows = await userRepository.findPage({
    limit: pageSize,
    cursorCreatedAt: decoded?.createdAt,
    cursorId: decoded?.id,
    search,
  });

  const { items, nextCursor } = paginate(rows, pageSize);
  return { items: items.map(serializeUser), nextCursor };
};

// Idempotent — suspending an already-suspended user just refreshes
// suspended_at rather than erroring, which matches how a "ban" action is
// expected to behave (unlike subscription revoke, which is deliberately not
// idempotent for a different reason — see admin-subscription.service.js).
export const suspendUser = async (id) => {
  const user = await userRepository.suspend(id);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND');
  }

  // Suspension takes effect at login/refresh already (auth.service.js), but
  // revoking outstanding refresh tokens here means the user can't even
  // attempt a refresh with a token that looks otherwise valid.
  await refreshTokenRepository.revokeAllForUser(id);
  await trackEvent(AMPLITUDE_EVENTS.SUSPENDED_USER, id);

  return serializeUser(user);
};

export const unsuspendUser = async (id) => {
  const user = await userRepository.unsuspend(id);
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND');
  }

  await trackEvent(AMPLITUDE_EVENTS.UNSUSPENDED_USER, id);
  return serializeUser(user);
};

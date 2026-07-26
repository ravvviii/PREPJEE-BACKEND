import { createAuthMiddleware } from './authenticate.js';
import { JWT_PRINCIPAL } from '../constants/index.js';

// Verifies a user access token, attaches `request.user = { id }`.
export const requireAuth = createAuthMiddleware(JWT_PRINCIPAL.USER, 'user');

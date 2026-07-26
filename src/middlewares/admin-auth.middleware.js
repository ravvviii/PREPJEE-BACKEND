import { createAuthMiddleware } from './authenticate.js';
import { JWT_PRINCIPAL } from '../constants/index.js';

// Verifies an admin access token, attaches `request.admin = { id, role }`.
export const requireAdminAuth = createAuthMiddleware(JWT_PRINCIPAL.ADMIN, 'admin');

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};

// Kept as the single source of truth for this enum — Phase 3's Postgres
// CHECK constraint and every request-validation schema should both read
// from this array so the DB and the app can never drift apart.
export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

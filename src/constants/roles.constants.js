export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};

// Kept as the single source of truth for this enum — Phase 3's Postgres
// CHECK constraint and every request-validation schema should both read
// from this array so the DB and the app can never drift apart.
export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

// Mirrors the question_answer_type Postgres enum (migrations/1785103000000).
export const ANSWER_TYPES = ['single_correct', 'multi_correct', 'numerical'];

// Mirrors the question_set_type Postgres enum (migrations/1785103100000).
export const QUESTION_SET_TYPES = ['practice', 'mock'];

// Mirrors the set_attempt_status Postgres enum (migrations/1785103100000).
export const SET_ATTEMPT_STATUSES = ['in_progress', 'submitted', 'expired'];

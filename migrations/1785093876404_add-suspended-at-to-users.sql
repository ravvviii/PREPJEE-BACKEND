-- Up Migration

-- NULL = active, set = suspended — same soft-delete-style convention as
-- deleted_at, so "when" is recorded for free instead of a bare boolean.
-- Suspension is enforced at login (verify-otp) and at refresh (token
-- rotation), same asymmetry the project already uses for refresh-token
-- revocation: a still-valid short-lived (15m) access token a suspended user
-- already holds keeps working until it naturally expires, but they can't
-- log in again or renew their session.
ALTER TABLE users ADD COLUMN suspended_at TIMESTAMPTZ(3);
CREATE INDEX users_suspended_at_idx ON users (suspended_at) WHERE suspended_at IS NOT NULL;

-- Down Migration

DROP INDEX IF EXISTS users_suspended_at_idx;
ALTER TABLE users DROP COLUMN suspended_at;

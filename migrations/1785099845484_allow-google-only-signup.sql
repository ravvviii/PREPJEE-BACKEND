-- Up Migration

-- Google sign-in is email-based, not phone-based — phone can no longer be
-- mandatory for every user. The CHECK constraint keeps the one invariant
-- that actually matters: every user must be reachable by at least one
-- identity method, phone or Google, never neither.
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_phone_or_google_id_required
  CHECK (phone IS NOT NULL OR google_id IS NOT NULL);

-- Down Migration

ALTER TABLE users DROP CONSTRAINT users_phone_or_google_id_required;
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

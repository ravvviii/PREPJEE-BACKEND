-- Up Migration

ALTER TABLE users ADD COLUMN password_hash TEXT;

ALTER TABLE users DROP CONSTRAINT users_phone_or_google_id_required;
ALTER TABLE users ADD CONSTRAINT users_identity_required
  CHECK (phone IS NOT NULL OR google_id IS NOT NULL OR (email IS NOT NULL AND password_hash IS NOT NULL));

-- Down Migration

ALTER TABLE users DROP CONSTRAINT users_identity_required;
ALTER TABLE users ADD CONSTRAINT users_phone_or_google_id_required
  CHECK (phone IS NOT NULL OR google_id IS NOT NULL);
ALTER TABLE users DROP COLUMN password_hash;

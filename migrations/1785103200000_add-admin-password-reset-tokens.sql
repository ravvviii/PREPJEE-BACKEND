-- Up Migration

CREATE TABLE admin_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX admin_password_reset_tokens_token_hash_key
  ON admin_password_reset_tokens (token_hash);
CREATE INDEX admin_password_reset_tokens_admin_id_idx
  ON admin_password_reset_tokens (admin_id);

-- Down Migration

DROP TABLE IF EXISTS admin_password_reset_tokens;

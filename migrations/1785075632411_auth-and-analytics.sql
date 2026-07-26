-- Up Migration

-- Phone-based, pre-auth — no user_id yet (the user may not exist until OTP
-- verification succeeds and creates them).
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX otp_codes_phone_idx ON otp_codes (phone);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON refresh_tokens (token_hash);

CREATE TABLE analytics_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX analytics_logs_user_id_idx ON analytics_logs (user_id);
CREATE INDEX analytics_logs_event_name_idx ON analytics_logs (event_name);

-- Down Migration

DROP TABLE IF EXISTS analytics_logs;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS otp_codes;

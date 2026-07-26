-- Up Migration

-- No unique constraint on (user_id, question_id): users can retry a question,
-- so this is an append-only log, not a one-row-per-question record. Accuracy
-- calculations (Phase 12/13) aggregate across all attempts for a question.
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  selected_option_id UUID REFERENCES options (id),
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX attempts_user_id_idx ON attempts (user_id);
CREATE INDEX attempts_question_id_idx ON attempts (question_id);
CREATE INDEX attempts_user_question_idx ON attempts (user_id, question_id);

CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX bookmarks_user_id_idx ON bookmarks (user_id);
-- Bookmarking is on/off, not a log — one row per (user, question).
CREATE UNIQUE INDEX bookmarks_user_question_key ON bookmarks (user_id, question_id);

-- Down Migration

DROP TABLE IF EXISTS bookmarks;
DROP TABLE IF EXISTS attempts;

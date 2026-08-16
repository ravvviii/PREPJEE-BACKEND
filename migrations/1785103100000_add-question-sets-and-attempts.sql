-- Up Migration

-- 'practice' — chapter-scoped, untimed-pressure-but-still-timed sets (e.g. 15Q sets
--   drawn from a chapter's question pool).
-- 'mock'     — full timed exam simulation (e.g. 25Q), usually cross-chapter within a
--   subject, labeled by exam_id (JEE Main / JEE Advanced) for realistic pacing.
CREATE TYPE question_set_type AS ENUM ('practice', 'mock');
CREATE TYPE set_attempt_status AS ENUM ('in_progress', 'submitted', 'expired');

CREATE TABLE question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects (id),
  class_id UUID NOT NULL REFERENCES classes (id),
  -- Null chapter_id means the set spans the whole subject (typical for a 'mock';
  -- 'practice' sets are always chapter-scoped in practice, but this isn't enforced
  -- at the schema level so a future "mixed practice" set type stays possible).
  chapter_id UUID REFERENCES chapters (id),
  exam_id UUID REFERENCES exams (id),
  type question_set_type NOT NULL,
  name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES admins (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX question_sets_chapter_id_idx ON question_sets (chapter_id);
CREATE INDEX question_sets_subject_class_idx ON question_sets (subject_id, class_id);
CREATE INDEX question_sets_exam_id_idx ON question_sets (exam_id);
CREATE INDEX question_sets_type_idx ON question_sets (type);
CREATE INDEX question_sets_is_active_idx ON question_sets (is_active);

CREATE TRIGGER trg_question_sets_updated_at
  BEFORE UPDATE ON question_sets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The fixed composition of a set — deterministic, curated at seed/admin time,
-- not randomly assembled per attempt (so every student sees the same Set 3).
CREATE TABLE question_set_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES question_sets (id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX question_set_items_set_question_key ON question_set_items (set_id, question_id);
CREATE INDEX question_set_items_set_id_idx ON question_set_items (set_id);

-- One row per user per attempt at a set. Unlike `attempts` (a per-question append-only
-- log), a set can be retried — each retry is its own row here with its own timer.
CREATE TABLE set_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES question_sets (id) ON DELETE RESTRICT,
  status set_attempt_status NOT NULL DEFAULT 'in_progress',
  total_questions INTEGER NOT NULL,
  correct_count INTEGER,
  score_percent INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Computed server-side as started_at + question_sets.duration_seconds at insert
  -- time — submissions arriving after this are graded but flagged 'expired'
  -- instead of trusting a client-reported elapsed time.
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX set_attempts_user_id_idx ON set_attempts (user_id);
CREATE INDEX set_attempts_set_id_idx ON set_attempts (set_id);
CREATE INDEX set_attempts_user_set_idx ON set_attempts (user_id, set_id);
CREATE INDEX set_attempts_status_idx ON set_attempts (status);

CREATE TABLE set_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_attempt_id UUID NOT NULL REFERENCES set_attempts (id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  selected_option_id UUID REFERENCES options (id),
  selected_option_ids UUID[],
  numerical_answer NUMERIC,
  -- Null until the whole set is submitted and graded — answers are collected
  -- ungraded as the student progresses so nothing leaks correctness mid-attempt.
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX set_attempt_answers_attempt_question_key ON set_attempt_answers (set_attempt_id, question_id);
CREATE INDEX set_attempt_answers_set_attempt_id_idx ON set_attempt_answers (set_attempt_id);

CREATE TRIGGER trg_set_attempt_answers_updated_at
  BEFORE UPDATE ON set_attempt_answers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- set_attempts has a user_id — per the user_phone denormalization convention
-- (migrations/1785093520861), extend both trigger functions in-place.
ALTER TABLE set_attempts ADD COLUMN user_phone TEXT;
CREATE INDEX set_attempts_user_phone_idx ON set_attempts (user_phone);

CREATE TRIGGER set_attempts_set_user_phone
  BEFORE INSERT ON set_attempts
  FOR EACH ROW EXECUTE FUNCTION set_user_phone_on_insert();

CREATE OR REPLACE FUNCTION propagate_user_phone_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE refresh_tokens SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE attempts SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE bookmarks SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE subscriptions SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE payments SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE analytics_logs SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE set_attempts SET user_phone = NEW.phone WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Down Migration

CREATE OR REPLACE FUNCTION propagate_user_phone_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE refresh_tokens SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE attempts SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE bookmarks SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE subscriptions SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE payments SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE analytics_logs SET user_phone = NEW.phone WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_attempts_set_user_phone ON set_attempts;
DROP INDEX IF EXISTS set_attempts_user_phone_idx;
ALTER TABLE set_attempts DROP COLUMN IF EXISTS user_phone;

DROP TABLE IF EXISTS set_attempt_answers;
DROP TABLE IF EXISTS set_attempts;
DROP TABLE IF EXISTS question_set_items;
DROP TABLE IF EXISTS question_sets;

DROP TYPE IF EXISTS set_attempt_status;
DROP TYPE IF EXISTS question_set_type;

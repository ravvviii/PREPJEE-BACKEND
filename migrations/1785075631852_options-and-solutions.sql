-- Up Migration

CREATE TABLE options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_image_url TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX options_question_id_idx ON options (question_id);

CREATE TABLE solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  explanation_text TEXT NOT NULL,
  solution_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One solution per question.
CREATE UNIQUE INDEX solutions_question_id_key ON solutions (question_id);

CREATE TRIGGER trg_solutions_updated_at
  BEFORE UPDATE ON solutions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS solutions;
DROP TABLE IF EXISTS options;

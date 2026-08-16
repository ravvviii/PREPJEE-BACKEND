-- Up Migration

-- Keep in sync with ANSWER_TYPES in src/constants/roles.constants.js.
-- 'single_correct' — classic 4-option MCQ, exactly one options row has is_correct = true.
-- 'multi_correct'  — JEE Advanced style, one or more options rows have is_correct = true;
--                     a submission must select the exact set to be marked correct.
-- 'numerical'       — JEE Advanced numerical-value questions: no options rows at all,
--                     graded against questions.numerical_answer within numerical_tolerance.
CREATE TYPE question_answer_type AS ENUM ('single_correct', 'multi_correct', 'numerical');

ALTER TABLE questions
  ADD COLUMN answer_type question_answer_type NOT NULL DEFAULT 'single_correct',
  ADD COLUMN numerical_answer NUMERIC,
  ADD COLUMN numerical_tolerance NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX questions_answer_type_idx ON questions (answer_type);

-- One attempt row can now carry a single option (legacy/single_correct), a set of
-- options (multi_correct), or a numeric value (numerical) — exactly one of the three
-- is populated depending on the question's answer_type, enforced at the service layer
-- rather than a CHECK constraint (mirrors how selected_option_id was already optional).
ALTER TABLE attempts
  ADD COLUMN selected_option_ids UUID[],
  ADD COLUMN numerical_answer NUMERIC;

-- Down Migration

ALTER TABLE attempts
  DROP COLUMN selected_option_ids,
  DROP COLUMN numerical_answer;

DROP INDEX IF EXISTS questions_answer_type_idx;

ALTER TABLE questions
  DROP COLUMN answer_type,
  DROP COLUMN numerical_answer,
  DROP COLUMN numerical_tolerance;

DROP TYPE IF EXISTS question_answer_type;

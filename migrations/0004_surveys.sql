-- Hila Food stage 6: surveys and response records.
-- Additive only. Never run against production D1 without separate approval.
CREATE TABLE IF NOT EXISTS surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL,
  prompt TEXT NOT NULL CHECK (length(trim(prompt)) BETWEEN 1 AND 500),
  type TEXT NOT NULL CHECK (type IN ('single', 'multiple', 'text')),
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey_order
  ON survey_questions(survey_id, sort_order, id);

CREATE TABLE IF NOT EXISTS survey_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 200),
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE,
  UNIQUE(question_id, label)
);
CREATE INDEX IF NOT EXISTS idx_survey_options_question_order
  ON survey_options(question_id, sort_order, id);

CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(survey_id, user_id),
  FOREIGN KEY (survey_id) REFERENCES surveys(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_created
  ON survey_responses(survey_id, created_at);

CREATE TABLE IF NOT EXISTS survey_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id TEXT NOT NULL,
  question_id INTEGER NOT NULL,
  option_id INTEGER,
  answer_text TEXT,
  FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES survey_questions(id),
  FOREIGN KEY (option_id) REFERENCES survey_options(id),
  CHECK (
    (option_id IS NOT NULL AND answer_text IS NULL) OR
    (option_id IS NULL AND answer_text IS NOT NULL)
  ),
  UNIQUE(response_id, question_id, option_id)
);
CREATE INDEX IF NOT EXISTS idx_survey_answers_question
  ON survey_answers(question_id, option_id);

CREATE TRIGGER IF NOT EXISTS trg_survey_answer_question_matches_response
BEFORE INSERT ON survey_answers
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM survey_responses r
    JOIN survey_questions q ON q.survey_id = r.survey_id
    WHERE r.id = NEW.response_id AND q.id = NEW.question_id
  ) THEN RAISE(ABORT, 'survey answer question mismatch') END;
  SELECT CASE WHEN NEW.option_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM survey_options o
    WHERE o.id = NEW.option_id AND o.question_id = NEW.question_id
  ) THEN RAISE(ABORT, 'survey answer option mismatch') END;
END;

-- Preserve response history: once responses exist, question/option structure cannot be deleted.
CREATE TRIGGER IF NOT EXISTS trg_survey_question_no_delete_with_responses
BEFORE DELETE ON survey_questions
WHEN EXISTS (SELECT 1 FROM survey_responses r WHERE r.survey_id = OLD.survey_id)
BEGIN
  SELECT RAISE(ABORT, 'survey questions cannot be deleted after responses');
END;
CREATE TRIGGER IF NOT EXISTS trg_survey_option_no_delete_with_responses
BEFORE DELETE ON survey_options
WHEN EXISTS (
  SELECT 1 FROM survey_questions q
  JOIN survey_responses r ON r.survey_id = q.survey_id
  WHERE q.id = OLD.question_id
)
BEGIN
  SELECT RAISE(ABORT, 'survey options cannot be deleted after responses');
END;

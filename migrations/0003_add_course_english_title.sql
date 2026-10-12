-- Proposed migration only; test against a disposable database before considering rollout.
ALTER TABLE courses ADD COLUMN title_en TEXT NOT NULL DEFAULT '';

-- Proposed migration only. Apply only to a disposable test database after review.
CREATE TABLE science_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (topic IN ('غذای فراسودمند', 'غلات و حبوبات', 'تغذیه کودک', 'بارداری', 'شیردهی', 'تغذیه زنان')),
  prepared_at TEXT NOT NULL,
  sources TEXT NOT NULL CHECK (json_valid(sources)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'rejected')),
  duplicate_key TEXT NOT NULL UNIQUE,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX science_articles_publication_idx
  ON science_articles(status, published_at DESC, id DESC);

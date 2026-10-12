import json
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0002_create_science_articles.sql"


class ScienceArticlesMigrationTest(unittest.TestCase):
    def test_creates_isolated_articles_table_and_enforces_constraints(self):
        self.assertTrue(MIGRATION.is_file())
        db = sqlite3.connect(":memory:")
        try:
            db.executescript(MIGRATION.read_text(encoding="utf-8"))
            db.execute(
                "INSERT INTO science_articles (title, summary, content, topic, prepared_at, sources, duplicate_key) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("عنوان", "خلاصه", "متن", "تغذیه زنان", "2026-10-12",
                 json.dumps([{"title": "WHO", "url": "https://www.who.int/"}]), "عنوان")
            )
            db.commit()
            row = db.execute("SELECT status, published_at FROM science_articles").fetchone()
            self.assertEqual(row, ("draft", None))
            self.assertEqual(
                db.execute("SELECT COUNT(*) FROM science_articles WHERE status = 'published'").fetchone()[0],
                0
            )
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(
                    "INSERT INTO science_articles (title, summary, content, topic, prepared_at, sources, duplicate_key) "
                    "VALUES ('دوم', 'خلاصه', 'متن', 'تغذیه زنان', '2026-10-12', '[]', 'عنوان')"
                )
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(
                    "INSERT INTO science_articles (title, summary, content, topic, prepared_at, sources, status, duplicate_key) "
                    "VALUES ('چهارم', 'خلاصه', 'متن', 'موضوع نامعتبر', '2026-10-12', '[]', 'draft', 'چهارم')"
                )
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()

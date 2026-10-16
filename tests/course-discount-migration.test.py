import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0001_add_course_discount_price.sql"


def apply_tracked_migration(connection, migration_path):
    """Model Wrangler's filename tracking for a disposable SQLite test database."""
    connection.execute(
        "CREATE TABLE IF NOT EXISTS d1_migrations "
        "(name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    name = migration_path.name
    already_applied = connection.execute(
        "SELECT 1 FROM d1_migrations WHERE name = ?", (name,)
    ).fetchone()
    if already_applied:
        return False

    sql = migration_path.read_text(encoding="utf-8").strip()
    connection.execute("BEGIN")
    try:
        connection.execute(sql)
        connection.execute("INSERT INTO d1_migrations (name) VALUES (?)", (name,))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    return True


class CourseDiscountMigrationTest(unittest.TestCase):
    def test_adds_only_optional_course_discount_and_skips_repeat(self):
        self.assertTrue(MIGRATION.is_file())
        connection = sqlite3.connect(":memory:")
        try:
            connection.execute(
                "CREATE TABLE courses ("
                "id INTEGER PRIMARY KEY, title TEXT NOT NULL, "
                "slug TEXT NOT NULL UNIQUE, price INTEGER DEFAULT 0)"
            )
            connection.execute(
                "INSERT INTO courses (id, title, slug, price) VALUES (1, 'Existing', 'existing', 500000)"
            )
            connection.commit()

            self.assertTrue(apply_tracked_migration(connection, MIGRATION))
            columns = [
                row[1] for row in connection.execute("PRAGMA table_info(courses)").fetchall()
            ]
            self.assertEqual(columns, ["id", "title", "slug", "price", "discount_price"])
            self.assertEqual(
                connection.execute(
                    "SELECT id, title, slug, price, discount_price FROM courses"
                ).fetchone(),
                (1, "Existing", "existing", 500000, None),
            )

            # A second migration-run skips the already tracked filename instead of
            # issuing ALTER TABLE a second time (SQLite has no ADD COLUMN IF NOT EXISTS).
            self.assertFalse(apply_tracked_migration(connection, MIGRATION))
            self.assertEqual(
                connection.execute(
                    "SELECT COUNT(*) FROM d1_migrations WHERE name = ?",
                    (MIGRATION.name,),
                ).fetchone()[0],
                1,
            )
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
            }
            self.assertEqual(tables, {"courses", "d1_migrations"})
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()

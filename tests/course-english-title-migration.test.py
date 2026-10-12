import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0003_add_course_english_title.sql"


class CourseEnglishTitleMigrationTest(unittest.TestCase):
    def test_adds_optional_english_title_without_changing_existing_courses(self):
        self.assertTrue(MIGRATION.is_file())
        db = sqlite3.connect(":memory:")
        try:
            db.execute(
                "CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, price INTEGER, discount_price INTEGER, image TEXT, active INTEGER)"
            )
            db.execute(
                "INSERT INTO courses (id, title, slug, description, price, discount_price, image, active) VALUES (1, 'اولین خوشمزه های من', 'first-tastes', 'توضیح موجود', 500000, 350000, 'course.webp', 1)"
            )
            db.commit()
            db.executescript(MIGRATION.read_text(encoding="utf-8"))
            columns = [row[1] for row in db.execute("PRAGMA table_info(courses)")]
            self.assertIn("title_en", columns)
            row = db.execute("SELECT title, slug, price, discount_price, title_en FROM courses WHERE id=1").fetchone()
            self.assertEqual(row, ("اولین خوشمزه های من", "first-tastes", 500000, 350000, ""))
            db.execute("UPDATE courses SET title_en=? WHERE id=1", ("My First Tastes",))
            self.assertEqual(db.execute("SELECT title_en FROM courses WHERE id=1").fetchone()[0], "My First Tastes")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()

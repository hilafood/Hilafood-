"""Ordered local migration-chain test for Hila Food.

The repository has no baseline migration for the pre-existing store tables, so
this test creates the legacy schema first, seeds representative store records,
then applies 0002, 0003 and 0004 in order. It never connects to Cloudflare D1.
"""
import pathlib
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = [
    ROOT / "migrations" / "0002_course_purchase_foundation.sql",
    ROOT / "migrations" / "0003_auth_rate_limits.sql",
    ROOT / "migrations" / "0004_surveys.sql",
]


def must_fail(db, sql, params=()):
    try:
        db.execute(sql, params)
    except sqlite3.IntegrityError:
        return
    raise AssertionError("Expected a database constraint to reject operation: " + sql)


def main():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
      -- Minimal legacy schema predating the additive migrations.
      CREATE TABLE courses (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        price INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        discount_price INTEGER,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_name TEXT NOT NULL DEFAULT '',
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL DEFAULT '',
        items TEXT NOT NULL DEFAULT '[]',
        subtotal INTEGER NOT NULL DEFAULT 0,
        shipping_id TEXT NOT NULL DEFAULT '',
        shipping_name TEXT NOT NULL DEFAULT '',
        shipping_price INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        payment_status TEXT NOT NULL DEFAULT 'unpaid'
      );
      INSERT INTO courses(id,title,slug,price,active)
        VALUES(1,'دوره آزمایشی','sample-course',500000,1);
      INSERT INTO products(id,name,price,discount_price,active)
        VALUES('p1','محصول آزمایشی',120000,90000,1);
      INSERT INTO orders(id,customer_phone,subtotal,total,payment_status)
        VALUES(1,'09000000000',90000,115000,'unpaid');
    """)

    for migration in MIGRATIONS:
        db.executescript(migration.read_text(encoding="utf-8"))

    course_columns = {row[1] for row in db.execute("PRAGMA table_info(courses)")}
    assert "discount_price" in course_columns
    assert db.execute("SELECT title,price FROM courses WHERE id=1").fetchone() == ("دوره آزمایشی", 500000)
    assert db.execute("SELECT name,price,discount_price FROM products WHERE id='p1'").fetchone() == ("محصول آزمایشی", 120000, 90000)
    assert db.execute("SELECT total,payment_status FROM orders WHERE id=1").fetchone() == (115000, "unpaid")

    db.execute("INSERT INTO users(id,phone,phone_verified_at) VALUES('u1','09000000001',CURRENT_TIMESTAMP)")
    db.execute("INSERT INTO auth_otp_challenges(id,phone,code_hash,expires_at) VALUES('otp1','09000000001','hash','2026-10-10T13:00:00Z')")
    db.execute("INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES('s1','u1','hash1','2026-10-11T13:00:00Z')")
    db.execute("INSERT INTO auth_rate_limits(key_hash,scope,window_started_at,count,last_action_at) VALUES('k1','otp',100,1,100)")

    db.execute("INSERT INTO surveys(title,status) VALUES('نظرسنجی آزمایشی','published')")
    survey_id = db.execute("SELECT id FROM surveys").fetchone()[0]
    db.execute("INSERT INTO survey_questions(survey_id,prompt,type,required,sort_order) VALUES(?, 'سؤال','single',1,0)", (survey_id,))
    question_id = db.execute("SELECT id FROM survey_questions WHERE survey_id=?", (survey_id,)).fetchone()[0]
    db.execute("INSERT INTO survey_options(question_id,label,sort_order) VALUES(?, 'گزینه الف',0)", (question_id,))
    option_id = db.execute("SELECT id FROM survey_options WHERE question_id=?", (question_id,)).fetchone()[0]
    db.execute("INSERT INTO survey_responses(id,survey_id,user_id) VALUES('response1',?,'u1')", (survey_id,))
    db.execute("INSERT INTO survey_answers(response_id,question_id,option_id) VALUES('response1',?,?)", (question_id, option_id))

    must_fail(db, "INSERT INTO survey_responses(id,survey_id,user_id) VALUES('response2',?,'u1')", (survey_id,))
    must_fail(db, "INSERT INTO survey_answers(response_id,question_id,option_id) VALUES('response1',?,?)", (question_id, option_id + 999))
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []

    print("PASS: legacy store fixture preserved through migrations 0002 -> 0003 -> 0004")
    print("PASS: course discount, OTP/session/rate-limit and survey schemas exist")
    print("PASS: survey unique-response and question/option integrity constraints hold")
    print("PASS: foreign_key_check reports no violations")
    db.close()


if __name__ == "__main__":
    main()

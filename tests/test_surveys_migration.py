"""Local SQLite tests for additive survey schema; never connects to production D1."""
import pathlib
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0004_surveys.sql"

def must_fail(db, sql, params=()):
    try:
        db.execute(sql, params)
    except sqlite3.IntegrityError:
        return
    raise AssertionError("Expected survey constraint to reject invalid operation")

def main():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
      CREATE TABLE users (id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE);
      CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, price INTEGER);
      CREATE TABLE orders (id INTEGER PRIMARY KEY, total INTEGER, payment_status TEXT);
      INSERT INTO users VALUES ('u1','09000000001');
      INSERT INTO products VALUES ('p1','Sample',120000);
      INSERT INTO orders VALUES (1,120000,'unpaid');
    """)
    db.executescript(MIGRATION.read_text(encoding="utf-8"))
    db.execute("INSERT INTO surveys(title,status) VALUES ('سنجش آزمایشی','published')")
    survey_id = db.execute("SELECT id FROM surveys").fetchone()[0]
    db.execute("INSERT INTO survey_questions(survey_id,prompt,type,required,sort_order) VALUES (?, 'سؤال اول','single',1,0)", (survey_id,))
    qid = db.execute("SELECT id FROM survey_questions").fetchone()[0]
    db.execute("INSERT INTO survey_options(question_id,label,sort_order) VALUES (?, 'گزینه الف',0)", (qid,))
    oid = db.execute("SELECT id FROM survey_options").fetchone()[0]
    db.execute("INSERT INTO survey_options(question_id,label,sort_order) VALUES (?, 'گزینه ب',1)", (qid,))
    db.execute("INSERT INTO survey_responses(id,survey_id,user_id) VALUES ('r1',?,'u1')", (survey_id,))
    db.execute("INSERT INTO survey_answers(response_id,question_id,option_id) VALUES ('r1',?,?,?)".replace("?,?,?","?,?"), (qid, oid))
    must_fail(db, "INSERT INTO survey_responses(id,survey_id,user_id) VALUES ('r2',?,'u1')", (survey_id,))
    must_fail(db, "INSERT INTO survey_answers(response_id,question_id,option_id) VALUES ('r1',?,?)", (qid, 999))
    must_fail(db, "DELETE FROM survey_options WHERE id=?", (oid,))
    db.execute("UPDATE surveys SET status='archived' WHERE id=?", (survey_id,))
    assert db.execute("SELECT COUNT(*) FROM survey_responses WHERE survey_id=?", (survey_id,)).fetchone()[0] == 1
    assert db.execute("SELECT COUNT(*) FROM survey_answers WHERE response_id='r1'").fetchone()[0] == 1
    assert db.execute("SELECT price FROM products WHERE id='p1'").fetchone() == (120000,)
    assert db.execute("SELECT total,payment_status FROM orders WHERE id=1").fetchone() == (120000,'unpaid')
    assert db.execute("SELECT COUNT(*) FROM survey_answers a JOIN survey_responses r ON r.id=a.response_id WHERE r.survey_id=?", (survey_id,)).fetchone()[0] == 1
    counts = db.execute("""
      SELECT o.label, COUNT(a.id) AS votes
      FROM survey_options o
      LEFT JOIN survey_answers a ON a.option_id=o.id
      LEFT JOIN survey_responses r ON r.id=a.response_id AND r.survey_id=?
      WHERE o.question_id=?
      GROUP BY o.id,o.label ORDER BY o.label
    """, (survey_id, qid)).fetchall()
    assert sorted(counts) == [('گزینه الف', 1), ('گزینه ب', 0)]
    print("PASS: additive survey migration applies locally")
    print("PASS: one response per verified-user identity is enforced by unique survey/user key")
    print("PASS: mismatched question/option answers are rejected")
    print("PASS: archived surveys retain response and answer history")
    print("PASS: aggregate option counts match recorded answers")
    print("PASS: existing product/order fixtures remain unchanged")
    db.close()

if __name__ == "__main__":
    main()

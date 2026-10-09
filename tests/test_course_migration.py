"""Local SQLite smoke test for the additive course-purchase migration.
Run with: python3 tests/test_course_migration.py
This uses an in-memory database and never connects to Cloudflare D1.
"""
import pathlib
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0002_course_purchase_foundation.sql"
AUTH_MIGRATION = ROOT / "migrations" / "0003_auth_rate_limits.sql"


def expect_integrity_error(db, sql):
    try:
        db.execute(sql)
    except sqlite3.IntegrityError:
        return
    raise AssertionError("Expected SQLite integrity constraint to reject operation")


def main():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
      CREATE TABLE courses (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        price INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1
      );
      CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, price INTEGER);
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_phone TEXT NOT NULL,
        total INTEGER,
        payment_status TEXT DEFAULT 'unpaid'
      );
      INSERT INTO courses(id,title,slug,price,active)
        VALUES(1,'Sample course','sample',500000,1);
      INSERT INTO products(id,name,price) VALUES('p1','Sample product',120000);
      INSERT INTO orders(id,customer_phone,total,payment_status)
        VALUES(1,'09000000000',120000,'unpaid');
    """)
    db.executescript(MIGRATION.read_text(encoding="utf-8"))
    db.executescript(AUTH_MIGRATION.read_text(encoding="utf-8"))

    course_columns = {row[1] for row in db.execute("PRAGMA table_info(courses)")}
    assert "discount_price" in course_columns
    assert db.execute("SELECT price FROM products WHERE id='p1'").fetchone() == (120000,)
    assert db.execute("SELECT total,payment_status FROM orders WHERE id=1").fetchone() == (120000, "unpaid")

    db.execute("INSERT INTO users(id,phone,phone_verified_at) VALUES('u1','09000000001',NULL)")
    db.execute("INSERT INTO auth_otp_challenges(id,phone,code_hash,expires_at,attempts) VALUES('c1','09000000001','hash','2026-10-10T01:00:00.000Z',0)")
    db.execute("UPDATE auth_otp_challenges SET attempts=5 WHERE id='c1'")
    expect_integrity_error(db, "UPDATE auth_otp_challenges SET attempts=6 WHERE id='c1'")
    db.execute("UPDATE auth_otp_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE id='c1'")
    expect_integrity_error(db, "UPDATE auth_otp_challenges SET consumed_at=NULL WHERE id='c1'")
    expect_integrity_error(db, "INSERT INTO course_orders(id,user_id,course_id,list_price_toman,amount_due_toman,status) VALUES('bad-paid','u1',1,500000,350000,'paid')")
    db.execute("INSERT INTO course_orders(id,user_id,course_id,list_price_toman,amount_due_toman) VALUES('o1','u1',1,500000,350000)")
    expect_integrity_error(db, "INSERT INTO course_entitlements(user_id,course_id,course_order_id) VALUES('u1',1,'o1')")
    expect_integrity_error(db, "UPDATE course_orders SET status='paid',gateway_authority='A',gateway_ref_id='R',verified_at=CURRENT_TIMESTAMP WHERE id='o1'")

    db.execute("UPDATE users SET phone_verified_at=CURRENT_TIMESTAMP WHERE id='u1'")
    db.execute("UPDATE course_orders SET status='pending_payment',gateway_authority='A' WHERE id='o1'")
    db.execute("UPDATE course_orders SET status='paid',gateway_ref_id='R',verified_at=CURRENT_TIMESTAMP WHERE id='o1'")
    db.execute("INSERT INTO course_entitlements(user_id,course_id,course_order_id) VALUES('u1',1,'o1')")
    expect_integrity_error(db, "INSERT INTO course_entitlements(user_id,course_id,course_order_id) VALUES('u1',1,'o1')")
    expect_integrity_error(db, "UPDATE course_orders SET status='failed' WHERE id='o1'")
    expect_integrity_error(db, "UPDATE course_orders SET amount_due_toman=1000 WHERE id='o1'")
    expect_integrity_error(db, "UPDATE course_entitlements SET user_id='other' WHERE course_order_id='o1'")
    expect_integrity_error(db, "DELETE FROM course_entitlements WHERE course_order_id='o1'")

    print("PASS: migration applies to a local SQLite fixture")
    print("PASS: existing product/order records remain unchanged")
    print("PASS: unverified ownership and direct payment confirmation are rejected")
    print("PASS: verified paid order grants one full-course entitlement only")
    print("PASS: paid orders cannot be silently downgraded")
    print("PASS: auth rate-limit migration and OTP database guards apply")
    db.close()


if __name__ == "__main__":
    main()

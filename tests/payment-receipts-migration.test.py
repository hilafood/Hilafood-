import pathlib, sqlite3, unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0004_create_payment_receipts.sql"
class PaymentReceiptsMigrationTest(unittest.TestCase):
    def test_metadata_migration_preserves_existing_orders(self):
        db = sqlite3.connect(":memory:")
        db.execute("""CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_address TEXT NOT NULL, items TEXT NOT NULL, total INTEGER DEFAULT 0, payment_status TEXT DEFAULT 'unpaid')""")
        db.execute("INSERT INTO orders(customer_name,customer_phone,customer_address,items,total) VALUES ('Test','09123456789','Address','[]',12345)")
        db.executescript(MIGRATION.read_text(encoding="utf-8"))
        self.assertEqual(db.execute("SELECT total,payment_status FROM orders WHERE id=1").fetchone(), (12345,"unpaid"))
        db.execute("INSERT INTO payment_receipts(order_id,storage_key,content_type,size_bytes) VALUES (1,'receipts/1/test.pdf','application/pdf',10)")
        self.assertEqual(db.execute("SELECT status FROM payment_receipts").fetchone()[0], "pending")
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("INSERT INTO payment_receipts(order_id,storage_key,content_type,size_bytes,status) VALUES (1,'key','text/plain',2,'public')")
        db.close()
if __name__ == "__main__": unittest.main()

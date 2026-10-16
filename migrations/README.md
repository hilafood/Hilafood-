# D1 migrations

This repository did not previously contain a numbered D1 migration directory or a Wrangler configuration. The numbered SQL files in this directory follow Cloudflare Wrangler's D1 migration convention.

## Course discount migration

`0001_add_course_discount_price.sql` adds only the nullable `courses.discount_price` column. SQLite/D1 does not support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; repeatability relies on Wrangler tracking applied migration filenames in `d1_migrations`. Do not run this SQL manually more than once against the same database.

Before applying it to any remote database:

1. Configure or select an explicitly identified **non-production test D1 database**. This repository does not currently identify a D1 database name/ID in a Wrangler config, so do not infer one.
2. From an environment with Wrangler and that test database's configuration, run:
   `wrangler d1 migrations apply <TEST_DATABASE_NAME> --remote`
3. Inspect `PRAGMA table_info(courses)` and verify the existing course rows remain present, with `discount_price` initially NULL.
4. Run `wrangler d1 migrations list <TEST_DATABASE_NAME> --remote` and confirm the migration is recorded as applied.

The CI test uses a disposable in-memory SQLite database to validate the SQL and migration-tracking behavior; it is not a connection to Cloudflare D1. No production migration has been run, and production schema state is unverified.

## Science articles migration

`0002_create_science_articles.sql` creates a separate table for editor-managed science articles. New articles are stored as `draft`; public reads filter strictly to `status = 'published'`. The API checks the admin key on every create/edit/publish/reject/delete operation and validates HTTPS source links. Editing a published article returns it to draft for re-review.

The migration is **proposed only**. The API returns HTTP 503 until the table exists; do not apply it to production as part of this branch review. Validate it with the disposable SQLite test:

`python3 tests/science-articles-migration.test.py`

No AI content provider or new Secret is configured. For that reason, no scheduled job claims to generate articles yet. A future 14-day workflow must be connected to an approved provider and a real duplicate/lease guard before it can generate drafts. It must never publish automatically.

## Independent English course title migration

`0003_add_course_english_title.sql` adds an optional `courses.title_en` column without rewriting existing course data. The admin API checks the live schema and returns a clear migration-required response if a non-empty English title is submitted before that column exists.

Validate the migration with `python3 tests/course-english-title-migration.test.py` against disposable SQLite. Do not apply it to production from this branch.

## Card-to-card payment receipts (proposed; not activated in production)

`0004_create_payment_receipts.sql` stores receipt metadata and review state only. Actual file bytes must be stored in a **private** Cloudflare R2 bucket bound to Pages Functions as `PAYMENT_RECEIPTS_BUCKET`; never use a public bucket or public asset path. The branch returns HTTP 503 for uploads until that binding exists. No Cloudflare setting or secret was changed.

The upload endpoint validates the order ID and customer phone against the stored order, accepts only JPEG/PNG/WebP/PDF files up to 5 MiB, and checks file signatures. Admin-only endpoints list/download private receipts and approve/reject them. Generic order updates cannot mark payment as paid. Uploading a receipt never counts as payment confirmation; an administrator must independently verify the transfer in the bank account.

Before activation, use a disposable test database: apply migration 0004 after the orders table exists; create a private R2 bucket in a non-production project and bind it as `PAYMENT_RECEIPTS_BUCKET`; verify authorization, invalid/spoofed files, size limits, order/phone matching, approval/rejection, and historical-order preservation; enter the real destination card and account-holder name in admin. Use only dummy orders and receipts in CI. The UI provides a prepared message and manual Eitaa fallback for customers unable to upload.

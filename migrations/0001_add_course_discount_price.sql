-- Add the optional course discount price.
-- Applied by Wrangler D1 migrations, which records applied migration filenames
-- in d1_migrations and skips them on subsequent runs.
ALTER TABLE courses ADD COLUMN discount_price INTEGER;

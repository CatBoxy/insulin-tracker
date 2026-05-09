-- Up Migration
ALTER TABLE doctors ADD COLUMN code VARCHAR(8) UNIQUE;

-- Generate codes for existing doctors
UPDATE doctors SET code = upper(substr(md5(random()::text), 1, 6))
WHERE code IS NULL;

-- Make code NOT NULL after backfill
ALTER TABLE doctors ALTER COLUMN code SET NOT NULL;
ALTER TABLE doctors ALTER COLUMN code SET DEFAULT upper(substr(md5(random()::text), 1, 6));

-- Down Migration
ALTER TABLE doctors DROP COLUMN IF EXISTS code;

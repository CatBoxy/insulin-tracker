-- Up Migration
ALTER TABLE measurements ADD COLUMN context VARCHAR(20);

-- Down Migration
ALTER TABLE measurements DROP COLUMN IF EXISTS context;

-- Up Migration
ALTER TABLE users ADD COLUMN phone VARCHAR(30);

-- Down Migration
ALTER TABLE users DROP COLUMN IF EXISTS phone;

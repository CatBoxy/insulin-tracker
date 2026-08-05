-- Up
ALTER TABLE study_participants
  ADD COLUMN allocation_method TEXT DEFAULT 'alternating',
  ADD COLUMN allocation_sequence INTEGER,
  ADD COLUMN allocated_at TIMESTAMPTZ;

-- Down
ALTER TABLE study_participants
  DROP COLUMN IF EXISTS allocation_method,
  DROP COLUMN IF EXISTS allocation_sequence,
  DROP COLUMN IF EXISTS allocated_at;

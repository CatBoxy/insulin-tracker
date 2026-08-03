-- UP: Add proper systolic/diastolic columns to measurements
ALTER TABLE measurements ADD COLUMN systolic INTEGER;
ALTER TABLE measurements ADD COLUMN diastolic INTEGER;

-- CHECK: systolic must be greater than diastolic when both are present
ALTER TABLE measurements ADD CONSTRAINT chk_systolic_gt_diastolic
  CHECK (systolic IS NULL OR diastolic IS NULL OR systolic > diastolic);

-- Backfill existing blood_pressure rows
UPDATE measurements
SET
  systolic = value,
  diastolic = (regexp_match(notes, 'diastolic:(\d+)'))[1]::integer
WHERE type = 'blood_pressure'
  AND notes ~ 'diastolic:\d+';

-- Log rows that have type blood_pressure but no parseable diastolic
DO $$
DECLARE
  bad RECORD;
BEGIN
  FOR bad IN
    SELECT id, patient_id, value, notes, recorded_at
    FROM measurements
    WHERE type = 'blood_pressure'
      AND (notes IS NULL OR notes !~ 'diastolic:\d+')
  LOOP
    RAISE NOTICE 'BP row id=% patient=% has no parseable diastolic (notes=%)',
      bad.id, bad.patient_id, bad.notes;
  END LOOP;
END $$;

-- Clean up the diastolic:XX prefix from notes after backfill
UPDATE measurements
SET notes = NULLIF(TRIM(regexp_replace(notes, 'diastolic:\d+\s*', '')), '')
WHERE type = 'blood_pressure'
  AND notes ~ 'diastolic:\d+';

-- Also backfill systolic for BP rows that had no diastolic in notes
UPDATE measurements
SET systolic = value
WHERE type = 'blood_pressure'
  AND systolic IS NULL;

-- DOWN (run manually to rollback):
-- ALTER TABLE measurements DROP CONSTRAINT IF EXISTS chk_systolic_gt_diastolic;
-- ALTER TABLE measurements DROP COLUMN IF EXISTS systolic;
-- ALTER TABLE measurements DROP COLUMN IF EXISTS diastolic;

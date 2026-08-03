-- Up
ALTER TABLE doctor_indices ADD COLUMN abdominal_circumference_cm NUMERIC(5,1);

-- Down
-- ALTER TABLE doctor_indices DROP COLUMN abdominal_circumference_cm;

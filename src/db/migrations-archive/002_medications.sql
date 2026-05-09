CREATE TABLE IF NOT EXISTS medications (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  daily_doses INTEGER NOT NULL DEFAULT 1,
  quantity INTEGER NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_patient_active ON medications(patient_id, active);

-- Extend existing alerts table for medication/refill support
ALTER TABLE alerts ALTER COLUMN measurement_id DROP NOT NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS medication_id INTEGER REFERENCES medications(id);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_date DATE;

CREATE INDEX IF NOT EXISTS idx_alerts_medication_type_ack ON alerts(medication_id, type, acknowledged);

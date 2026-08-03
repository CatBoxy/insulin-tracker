-- Add last_interaction_at to patients
ALTER TABLE patients ADD COLUMN last_interaction_at TIMESTAMPTZ;

-- App sessions table for engagement metrics
CREATE TABLE app_sessions (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('web', 'mobile')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_app_sessions_patient ON app_sessions(patient_id, started_at DESC);

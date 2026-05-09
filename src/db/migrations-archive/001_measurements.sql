CREATE TABLE IF NOT EXISTS measurement_reference_ranges (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  sub_type VARCHAR(50),
  min_value NUMERIC NOT NULL,
  max_value NUMERIC NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(type, sub_type)
);

CREATE TABLE IF NOT EXISTS measurements (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  value NUMERIC,
  systolic NUMERIC,
  diastolic NUMERIC,
  notes TEXT,
  measured_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_measurement_fields CHECK (
    (type = 'glucemia' AND value IS NOT NULL) OR
    (type = 'blood_pressure' AND systolic IS NOT NULL AND diastolic IS NOT NULL)
  )
);

CREATE INDEX idx_measurements_patient_type ON measurements(patient_id, type, measured_at);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  measurement_id INTEGER NOT NULL REFERENCES measurements(id),
  patient_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_patient ON alerts(patient_id, created_at);

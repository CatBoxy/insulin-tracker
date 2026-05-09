-- Baseline migration: represents the complete schema as of 2026-05-09.
-- This migration is marked as "already applied" on existing databases.
-- See src/db/migrations-archive/ for the original migration files.

-- UP

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'patient',
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_doctor (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_doctor_doctor ON patient_doctor(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_patient ON patient_doctor(patient_id);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location TEXT,
  type VARCHAR(20) NOT NULL DEFAULT 'in_person',
  reason TEXT,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id, scheduled_at);

CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id, status);

CREATE TABLE IF NOT EXISTS prescription_items (
  id SERIAL PRIMARY KEY,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  instructions TEXT
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);

CREATE TABLE IF NOT EXISTS measurement_reference_ranges (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  sub_type VARCHAR(50),
  min_value NUMERIC NOT NULL,
  max_value NUMERIC NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(type, sub_type)
);

CREATE TABLE IF NOT EXISTS measurements (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  value NUMERIC,
  unit VARCHAR(20),
  recorded_by VARCHAR(50),
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measurements_patient_type ON measurements(patient_id, type, recorded_at);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  title TEXT,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alerts(patient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_patient_unread ON alerts(patient_id, read) WHERE read = FALSE;

CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);

INSERT INTO measurement_reference_ranges (type, sub_type, min_value, max_value, unit)
VALUES
  ('glucemia', NULL, 70, 140, 'mg/dL'),
  ('blood_pressure', 'systolic', 90, 120, 'mmHg'),
  ('blood_pressure', 'diastolic', 60, 80, 'mmHg')
ON CONFLICT (type, sub_type) DO NOTHING;

COMMIT;

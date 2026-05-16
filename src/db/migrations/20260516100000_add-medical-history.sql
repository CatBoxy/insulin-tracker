-- Patient medical history: family history, personal history, and medications

CREATE TABLE patient_family_history (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id),
  condition VARCHAR(50) NOT NULL,
  has_condition BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id, condition)
);

CREATE TABLE patient_personal_history (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id),
  condition VARCHAR(50) NOT NULL,
  has_condition BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id, condition)
);

CREATE TABLE patient_medications (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id),
  condition VARCHAR(50) NOT NULL,
  medication_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track whether patient completed the onboarding history form
ALTER TABLE patients ADD COLUMN medical_history_completed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_patient_family_history_patient ON patient_family_history(patient_id);
CREATE INDEX idx_patient_personal_history_patient ON patient_personal_history(patient_id);
CREATE INDEX idx_patient_medications_patient ON patient_medications(patient_id);

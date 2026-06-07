CREATE TABLE doctor_indices (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  calf_circumference_cm NUMERIC,
  dynamometer_force_mmlm NUMERIC,
  chair_test_seconds NUMERIC,
  insulin_resistance_index NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctor_indices_patient ON doctor_indices(patient_id, recorded_at DESC);
CREATE INDEX idx_doctor_indices_doctor ON doctor_indices(doctor_id);

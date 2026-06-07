CREATE TABLE body_composition (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  adipose_pct NUMERIC NOT NULL,
  muscle_pct NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_body_comp_patient ON body_composition(patient_id, recorded_at DESC);

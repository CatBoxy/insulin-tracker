-- Up Migration

CREATE TABLE lab_results (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  timepoint TEXT NOT NULL CHECK (timepoint IN ('baseline','month_3','month_6','unscheduled')),
  collected_on DATE NOT NULL,
  analyte TEXT NOT NULL,
  value NUMERIC(10,3) NOT NULL,
  unit TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual','parsed')),
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  attachment_id INTEGER REFERENCES checkup_attachments(id),
  UNIQUE (patient_id, timepoint, analyte, collected_on)
);

CREATE INDEX idx_lab_results_patient ON lab_results(patient_id, timepoint);

-- Down Migration

DROP TABLE IF EXISTS lab_results;

CREATE TABLE study_visits (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES study_participants(id),
  visit_type TEXT NOT NULL CHECK (visit_type IN ('baseline','month_3','month_6')),
  scheduled_date DATE,
  performed_date DATE,
  performed_by INTEGER REFERENCES doctors(id),
  notes TEXT,
  UNIQUE (participant_id, visit_type)
);

ALTER TABLE lab_results ADD COLUMN study_visit_id INTEGER REFERENCES study_visits(id);
ALTER TABLE doctor_indices ADD COLUMN study_visit_id INTEGER REFERENCES study_visits(id);
ALTER TABLE body_composition ADD COLUMN study_visit_id INTEGER REFERENCES study_visits(id);
ALTER TABLE measurements ADD COLUMN study_visit_id INTEGER REFERENCES study_visits(id);

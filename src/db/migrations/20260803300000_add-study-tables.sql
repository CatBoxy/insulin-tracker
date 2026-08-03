-- Up
CREATE TABLE study_participants (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL UNIQUE REFERENCES patients(id),
  participant_code TEXT NOT NULL UNIQUE,
  arm TEXT NOT NULL CHECK (arm IN ('intervention','control')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_version TEXT NOT NULL,
  consent_signed_at DATE NOT NULL,
  baseline_hba1c NUMERIC(4,2),
  withdrawn_at TIMESTAMPTZ,
  withdrawal_reason TEXT
);

CREATE TABLE study_arm_audit (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES study_participants(id),
  old_arm TEXT,
  new_arm TEXT NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);

CREATE TABLE study_screening_log (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id),
  screened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  eligible BOOLEAN NOT NULL,
  reason TEXT,
  screened_by INTEGER REFERENCES users(id)
);

CREATE TABLE study_incidents (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES study_participants(id),
  occurred_on DATE NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  recorded_by INTEGER NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down
DROP TABLE IF EXISTS study_incidents;
DROP TABLE IF EXISTS study_screening_log;
DROP TABLE IF EXISTS study_arm_audit;
DROP TABLE IF EXISTS study_participants;

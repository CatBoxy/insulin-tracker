-- Up Migration

CREATE TABLE checkup_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  display_name_es VARCHAR(100) NOT NULL,
  description_es TEXT,
  category VARCHAR(20) NOT NULL CHECK (category IN ('specialist', 'lab', 'imaging', 'other')),
  default_frequency_months INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_checkups (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  checkup_type_id INT NOT NULL REFERENCES checkup_types(id),
  frequency_months_override INT,
  last_completed_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  enabled_by_doctor_id INT REFERENCES doctors(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, checkup_type_id)
);

CREATE INDEX idx_patient_checkups_patient_active
  ON patient_checkups(patient_id) WHERE active = TRUE;

CREATE TABLE checkup_completions (
  id SERIAL PRIMARY KEY,
  patient_checkup_id INT NOT NULL REFERENCES patient_checkups(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  appointment_id INT REFERENCES appointments(id),
  notes TEXT,
  reported_by_user_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checkup_completions_lookup
  ON checkup_completions(patient_checkup_id, completed_at DESC);

CREATE OR REPLACE FUNCTION sync_patient_checkup_last_completed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE patient_checkups
  SET last_completed_at = (
    SELECT MAX(completed_at) FROM checkup_completions
    WHERE patient_checkup_id = COALESCE(NEW.patient_checkup_id, OLD.patient_checkup_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.patient_checkup_id, OLD.patient_checkup_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_checkup_completions_sync
AFTER INSERT OR UPDATE OR DELETE ON checkup_completions
FOR EACH ROW EXECUTE FUNCTION sync_patient_checkup_last_completed();

ALTER TABLE appointments
  ADD COLUMN checkup_type_id INT REFERENCES checkup_types(id);

-- Seed checkup types
INSERT INTO checkup_types (code, display_name_es, category, default_frequency_months, sort_order) VALUES
  ('diabetologist',          'Diabetólogo',               'specialist', 6,    10),
  ('lab',                    'Laboratorio',               'lab',        6,    20),
  ('cardiologist',           'Cardiólogo',                'specialist', 12,   30),
  ('neurologist',            'Neurólogo',                 'specialist', 12,   40),
  ('nephrologist',           'Nefrólogo',                 'specialist', 12,   50),
  ('ophthalmologist_fundus', 'Oftalmólogo (fondo de ojo)','specialist', 12,   60),
  ('abdominal_ultrasound',   'Ecografía abdominal',       'imaging',    12,   70),
  ('echocardiogram',         'Ecocardiograma',            'imaging',    12,   80),
  ('nutrition',              'Nutricionista',             'other',      NULL, 90);

-- Auto-provision existing patients
INSERT INTO patient_checkups (patient_id, checkup_type_id)
SELECT p.id, ct.id
FROM patients p
CROSS JOIN checkup_types ct
ON CONFLICT (patient_id, checkup_type_id) DO NOTHING;

-- Down Migration

DELETE FROM patient_checkups;
DROP TRIGGER IF EXISTS trg_checkup_completions_sync ON checkup_completions;
DROP FUNCTION IF EXISTS sync_patient_checkup_last_completed();
DROP TABLE IF EXISTS checkup_completions;
DROP TABLE IF EXISTS patient_checkups;
ALTER TABLE appointments DROP COLUMN IF EXISTS checkup_type_id;
DROP TABLE IF EXISTS checkup_types;

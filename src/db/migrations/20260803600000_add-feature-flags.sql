-- Up
CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feature_flag_arm_settings (
  flag_key TEXT NOT NULL REFERENCES feature_flags(key),
  arm TEXT NOT NULL CHECK (arm IN ('intervention','control')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (flag_key, arm)
);

CREATE TABLE feature_flag_audit (
  id SERIAL PRIMARY KEY,
  flag_key TEXT NOT NULL,
  arm TEXT NOT NULL,
  old_value BOOLEAN,
  new_value BOOLEAN NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);

-- Seed flags
INSERT INTO feature_flags (key, label, description) VALUES
  ('messaging_whatsapp', 'WhatsApp reminders', 'Glucose, BP, appointment, and inactivity reminders via WhatsApp'),
  ('messaging_push', 'Push notifications', 'In-app push for doctor actions, education content'),
  ('inactivity_protocol', 'Inactivity protocol', '3-day inactivity triggers preventive message'),
  ('education_module', 'Education module', 'In-app health education content'),
  ('appointment_reminders', 'Appointment reminders', 'Pre-appointment WhatsApp reminders'),
  ('in_app_feedback_messages', 'Feedback messages', 'Post-measurement feedback ("todo OK" or warning)');

-- Default settings: all disabled for both arms initially
INSERT INTO feature_flag_arm_settings (flag_key, arm, enabled)
SELECT key, arm, false
FROM feature_flags, (VALUES ('intervention'), ('control')) AS arms(arm);

-- Down
DROP TABLE IF EXISTS feature_flag_audit;
DROP TABLE IF EXISTS feature_flag_arm_settings;
DROP TABLE IF EXISTS feature_flags;

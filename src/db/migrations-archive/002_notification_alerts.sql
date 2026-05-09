-- Add dismissed/dismissed_at columns to existing alerts table
-- and make measurement_id nullable (notification alerts have no measurement)
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

ALTER TABLE alerts
  ALTER COLUMN measurement_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_patient_dismissed
  ON alerts (patient_id, dismissed);

-- Device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token VARCHAR(512) NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens (user_id);

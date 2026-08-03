-- Up
CREATE TABLE message_send_refusals (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_send_refusals_patient ON message_send_refusals(patient_id, created_at DESC);

-- Down
DROP TABLE IF EXISTS message_send_refusals;

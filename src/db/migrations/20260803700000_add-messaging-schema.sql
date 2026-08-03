-- Up
CREATE TABLE message_templates (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  version INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','push')),
  category TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'es_AR',
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  wa_template_name TEXT,
  wa_status TEXT,
  wa_approved_at TIMESTAMPTZ,
  wa_rejection_reason TEXT,
  approved_by_doctor INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key, version, channel)
);

CREATE TABLE message_schedule_rules (
  id SERIAL PRIMARY KEY,
  template_key TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron','inactivity','appointment_lead','checkup_due')),
  cron_expr TEXT,
  params JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES study_participants(id),
  template_id INTEGER NOT NULL REFERENCES message_templates(id),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','push')),
  trigger_rule_id INTEGER REFERENCES message_schedule_rules(id),
  trigger_context JSONB,
  rendered_body TEXT NOT NULL,
  variables_used JSONB NOT NULL DEFAULT '{}',
  personalized BOOLEAN NOT NULL DEFAULT false,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','read','failed','suppressed')),
  provider_msg_id TEXT,
  suppressed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_participant_scheduled ON messages(participant_id, scheduled_for);
CREATE INDEX idx_messages_status ON messages(status);

CREATE TABLE message_events (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id),
  event TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  raw_payload JSONB,
  UNIQUE (message_id, event, occurred_at)
);

CREATE TABLE patient_channels (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','push')),
  identifier TEXT NOT NULL,
  opted_in BOOLEAN NOT NULL DEFAULT false,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (patient_id, channel, identifier)
);

-- Down
DROP TABLE IF EXISTS patient_channels;
DROP TABLE IF EXISTS message_events;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS message_schedule_rules;
DROP TABLE IF EXISTS message_templates;

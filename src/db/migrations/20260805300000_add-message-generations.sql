-- Up
CREATE TABLE message_generations (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  model_id TEXT,
  template_key TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  prompt_inputs JSONB NOT NULL,
  raw_model_output TEXT,
  guardrails_modified BOOLEAN NOT NULL DEFAULT false,
  guardrails_rejected BOOLEAN NOT NULL DEFAULT false,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  final_body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_generations_message ON message_generations(message_id);

-- Down
DROP TABLE IF EXISTS message_generations;

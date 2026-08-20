CREATE TABLE questionnaires (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questionnaire_items (
  id SERIAL PRIMARY KEY,
  questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id),
  item_order INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  response_type TEXT NOT NULL CHECK (response_type IN ('single_choice','likert_5','numeric','free_text')),
  options JSONB,
  required BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE questionnaire_responses (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES study_participants(id),
  questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id),
  study_visit_id INTEGER REFERENCES study_visits(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE questionnaire_answers (
  id SERIAL PRIMARY KEY,
  response_id INTEGER NOT NULL REFERENCES questionnaire_responses(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES questionnaire_items(id),
  value TEXT NOT NULL
);

CREATE INDEX idx_questionnaire_responses_participant ON questionnaire_responses(participant_id);

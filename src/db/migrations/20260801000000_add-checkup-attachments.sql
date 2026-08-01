-- Up Migration

CREATE TABLE checkup_attachments (
  id SERIAL PRIMARY KEY,
  checkup_completion_id INT NOT NULL REFERENCES checkup_completions(id) ON DELETE CASCADE,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  cloudinary_url TEXT NOT NULL,
  original_filename VARCHAR(255),
  file_type VARCHAR(20) NOT NULL,
  file_size_bytes INT,
  uploaded_by_user_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checkup_attachments_completion
  ON checkup_attachments(checkup_completion_id);

CREATE TABLE checkup_parsed_results (
  id SERIAL PRIMARY KEY,
  checkup_attachment_id INT NOT NULL REFERENCES checkup_attachments(id) ON DELETE CASCADE,
  parse_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  document_type VARCHAR(50),
  parsed_data JSONB,
  raw_text TEXT,
  model_used VARCHAR(50),
  confidence_score NUMERIC(3,2),
  error_message TEXT,
  parsed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checkup_parsed_results_attachment
  ON checkup_parsed_results(checkup_attachment_id);

CREATE INDEX idx_checkup_parsed_results_status
  ON checkup_parsed_results(parse_status);

-- Down Migration

DROP TABLE IF EXISTS checkup_parsed_results;
DROP TABLE IF EXISTS checkup_attachments;

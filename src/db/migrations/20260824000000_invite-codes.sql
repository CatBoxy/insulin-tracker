CREATE TABLE invite_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(8) UNIQUE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  notes TEXT,
  used_by INTEGER REFERENCES users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invite_codes_code ON invite_codes(code);

BEGIN;

-- Add email verification columns to users
ALTER TABLE users
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN email_verified_at TIMESTAMPTZ;

-- Grandfather existing users
UPDATE users SET email_verified = TRUE, email_verified_at = NOW();

-- Email verification tokens (48h TTL)
CREATE TABLE email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evtoken_hash ON email_verification_tokens(token_hash);
CREATE INDEX idx_evtoken_user ON email_verification_tokens(user_id);

-- Password reset tokens (15 min TTL, single-use)
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prtoken_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_prtoken_user ON password_reset_tokens(user_id);

COMMIT;

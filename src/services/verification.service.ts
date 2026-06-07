import crypto from "crypto";
import pool from "@/lib/db";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// --- Email Verification ---

export async function createVerificationToken(userId: number): Promise<string> {
  await pool.query("DELETE FROM email_verification_tokens WHERE user_id = $1", [userId]);

  const raw = generateToken();
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await pool.query(
    "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hash, expiresAt]
  );

  return raw;
}

export async function verifyEmail(rawToken: string): Promise<{ success: boolean; userId?: number; error?: string }> {
  const hash = hashToken(rawToken);

  const { rows } = await pool.query(
    "SELECT id, user_id, expires_at FROM email_verification_tokens WHERE token_hash = $1",
    [hash]
  );

  if (rows.length === 0) return { success: false, error: "Token inválido" };

  const token = rows[0];
  if (new Date(token.expires_at) < new Date()) {
    return { success: false, error: "El enlace expiró. Solicitá uno nuevo." };
  }

  await pool.query(
    "UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE id = $1",
    [token.user_id]
  );
  await pool.query("DELETE FROM email_verification_tokens WHERE id = $1", [token.id]);

  return { success: true, userId: token.user_id };
}

// --- Password Reset ---

export async function createPasswordResetToken(userId: number): Promise<string> {
  await pool.query(
    "DELETE FROM password_reset_tokens WHERE user_id = $1 AND used = FALSE",
    [userId]
  );

  const raw = generateToken();
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await pool.query(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hash, expiresAt]
  );

  return raw;
}

export async function validateAndConsumeResetToken(
  rawToken: string
): Promise<{ success: boolean; userId?: number; error?: string }> {
  const hash = hashToken(rawToken);

  const { rows } = await pool.query(
    "SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = $1",
    [hash]
  );

  if (rows.length === 0) return { success: false, error: "Token inválido" };

  const token = rows[0];
  if (token.used) return { success: false, error: "Este enlace ya fue utilizado. Solicitá uno nuevo." };
  if (new Date(token.expires_at) < new Date()) {
    return { success: false, error: "El enlace expiró. Solicitá uno nuevo." };
  }

  await pool.query("UPDATE password_reset_tokens SET used = TRUE WHERE id = $1", [token.id]);

  return { success: true, userId: token.user_id };
}

export async function resetPassword(userId: number, newPasswordHash: string): Promise<void> {
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newPasswordHash, userId]);
}

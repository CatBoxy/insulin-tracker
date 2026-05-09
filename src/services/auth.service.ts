import pool from "@/lib/db";
import { hashPassword, comparePassword, signToken } from "@/lib/auth";

export async function findUserByEmail(email: string) {
  const { rows } = await pool.query(
    "SELECT id, email, password_hash, role FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function verifyCredentials(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return null;

  return { id: user.id, email: user.email, role: user.role };
}

export async function createPatientUser(email: string, password: string) {
  const password_hash = await hashPassword(password);

  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role",
    [email.toLowerCase(), password_hash, "patient", email.split("@")[0], ""]
  );

  const user = rows[0];

  await pool.query("INSERT INTO patients (user_id) VALUES ($1)", [user.id]);

  return user;
}

export async function emailExists(email: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  return rows.length > 0;
}

export async function createToken(user: { id: number; email: string; role: string }) {
  return signToken({ sub: user.id, email: user.email, role: user.role });
}

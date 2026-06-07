import pool from "@/lib/db";
import { hashPassword, comparePassword, signToken } from "@/lib/auth";

export async function findUserByEmail(email: string) {
  const { rows } = await pool.query(
    "SELECT id, email, password_hash, role, first_name, email_verified FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function verifyCredentials(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return null;

  return { id: user.id, email: user.email, role: user.role, email_verified: user.email_verified };
}

interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  role?: "patient" | "doctor";
}

export async function createUser(input: CreateUserInput) {
  const { email, password, first_name, last_name, date_of_birth, gender, phone, role = "patient" } = input;
  const password_hash = await hashPassword(password);

  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role",
    [email.toLowerCase(), password_hash, role, first_name, last_name, phone || null]
  );

  const user = rows[0];

  if (role === "patient") {
    const { rows: patientRows } = await pool.query(
      "INSERT INTO patients (user_id, date_of_birth, gender) VALUES ($1, $2, $3) RETURNING id",
      [user.id, date_of_birth || null, gender || null]
    );
    // Auto-provision checkup tracking for the new patient
    await pool.query(
      `INSERT INTO patient_checkups (patient_id, checkup_type_id)
       SELECT $1, id FROM checkup_types`,
      [patientRows[0].id]
    );
  } else if (role === "doctor") {
    await pool.query("INSERT INTO doctors (user_id) VALUES ($1)", [user.id]);
  }

  return user;
}

/** @deprecated Use createUser instead */
export async function createPatientUser(email: string, password: string) {
  return createUser({ email, password, first_name: email.split("@")[0], last_name: "" });
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

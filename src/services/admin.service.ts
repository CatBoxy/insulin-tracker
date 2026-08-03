import pool from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function listUsers() {
  const { rows } = await pool.query(
    "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC"
  );
  return rows;
}

export async function createUser(email: string, password: string, role: string) {
  const password_hash = await hashPassword(password);
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, created_at",
    [email.toLowerCase(), password_hash, role, email.split("@")[0], ""]
  );
  return rows[0];
}

export async function emailExists(email: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  return rows.length > 0;
}

export async function listAssignments() {
  const { rows } = await pool.query(`
    SELECT pd.id, pd.status, pd.assigned_at,
      du.email as doctor_email, du.first_name as doctor_first_name, du.last_name as doctor_last_name,
      pu.email as patient_email, pu.first_name as patient_first_name, pu.last_name as patient_last_name,
      p.id as patient_id, d.id as doctor_id, du.id as doctor_user_id
    FROM patient_doctor pd
    JOIN doctors d ON d.id = pd.doctor_id
    JOIN users du ON du.id = d.user_id
    JOIN patients p ON p.id = pd.patient_id
    JOIN users pu ON pu.id = p.user_id
    ORDER BY pd.assigned_at DESC
  `);
  return rows;
}

export async function assignPatientToDoctor(doctorUserId: number, rawPatientId: number) {
  // Resolve patient_id from user_id
  const { rows: patientLookup } = await pool.query(
    "SELECT id FROM patients WHERE user_id = $1",
    [rawPatientId]
  );

  let patientId: number;
  if (patientLookup.length > 0) {
    patientId = patientLookup[0].id;
  } else {
    const { rows: newPatient } = await pool.query(
      "INSERT INTO patients (user_id) VALUES ($1) RETURNING id",
      [rawPatientId]
    );
    patientId = newPatient[0].id;
  }

  // Get or create doctor record
  let { rows: doctorRows } = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1",
    [doctorUserId]
  );

  if (doctorRows.length === 0) {
    const { rows: userRows } = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [doctorUserId]
    );
    if (userRows.length === 0 || userRows[0].role !== "doctor") {
      throw new Error("USER_NOT_DOCTOR");
    }
    const { rows: newDoc } = await pool.query(
      "INSERT INTO doctors (user_id) VALUES ($1) RETURNING id",
      [doctorUserId]
    );
    doctorRows = newDoc;
  }

  const doctorId = doctorRows[0].id;

  // Check existing assignment
  const { rows: existing } = await pool.query(
    "SELECT id, status FROM patient_doctor WHERE doctor_id = $1 AND patient_id = $2",
    [doctorId, patientId]
  );

  if (existing.length > 0) {
    if (existing[0].status === "active") {
      throw new Error("ALREADY_ASSIGNED");
    }
    await pool.query(
      "UPDATE patient_doctor SET status = 'active', assigned_at = NOW() WHERE id = $1",
      [existing[0].id]
    );
    return "reassigned";
  }

  await pool.query(
    "INSERT INTO patient_doctor (doctor_id, patient_id, status, assigned_at) VALUES ($1, $2, 'active', NOW())",
    [doctorId, patientId]
  );
  return "assigned";
}

export async function removeAssignment(id: number) {
  await pool.query(
    "UPDATE patient_doctor SET status = 'inactive' WHERE id = $1",
    [id]
  );
}

export async function listPatientsWithDob() {
  const { rows } = await pool.query(`
    SELECT p.id as patient_id, u.first_name, u.last_name, u.email, p.date_of_birth
    FROM patients p
    JOIN users u ON u.id = p.user_id
    ORDER BY u.last_name, u.first_name
  `);
  return rows;
}

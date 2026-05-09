import pool from "@/lib/db";
import { hashPassword, comparePassword } from "@/lib/auth";

export async function getAccount(userId: number) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone,
            p.date_of_birth, p.gender
     FROM users u
     LEFT JOIN patients p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function updateAccount(userId: number, data: {
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
}) {
  await pool.query(
    "UPDATE users SET first_name = $1, last_name = $2, phone = $3 WHERE id = $4",
    [data.first_name, data.last_name, data.phone || null, userId]
  );

  // Update patient-specific fields if patient record exists
  if (data.date_of_birth !== undefined || data.gender !== undefined) {
    await pool.query(
      `UPDATE patients SET
        date_of_birth = COALESCE($1, date_of_birth),
        gender = COALESCE($2, gender)
       WHERE user_id = $3`,
      [data.date_of_birth || null, data.gender || null, userId]
    );
  }
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId]
  );
  if (rows.length === 0) return false;

  const valid = await comparePassword(currentPassword, rows[0].password_hash);
  if (!valid) return false;

  const newHash = await hashPassword(newPassword);
  await pool.query(
    "UPDATE users SET password_hash = $1 WHERE id = $2",
    [newHash, userId]
  );
  return true;
}

export async function getLinkedDoctors(userId: number) {
  const { rows } = await pool.query(
    `SELECT pd.id as assignment_id, d.id as doctor_id,
            u.first_name, u.last_name, u.email, pd.assigned_at
     FROM patient_doctor pd
     JOIN doctors d ON d.id = pd.doctor_id
     JOIN users u ON u.id = d.user_id
     JOIN patients p ON p.id = pd.patient_id
     WHERE p.user_id = $1 AND pd.status = 'active'
     ORDER BY pd.assigned_at DESC`,
    [userId]
  );
  return rows;
}

export async function unlinkDoctor(userId: number, assignmentId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE patient_doctor SET status = 'inactive'
     WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)
     AND status = 'active'`,
    [assignmentId, userId]
  );
  return (rowCount ?? 0) > 0;
}

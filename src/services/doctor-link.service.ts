import pool from "@/lib/db";

export async function getDoctorByCode(code: string) {
  const { rows } = await pool.query(
    `SELECT d.id, d.code, u.first_name, u.last_name, u.email
     FROM doctors d
     JOIN users u ON u.id = d.user_id
     WHERE d.code = $1`,
    [code.toUpperCase()]
  );
  return rows[0] ?? null;
}

export async function getDoctorCode(userId: number): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT code FROM doctors WHERE user_id = $1",
    [userId]
  );
  return rows[0]?.code ?? null;
}

export async function linkPatientToDoctor(patientId: number, doctorId: number): Promise<"linked" | "already_linked" | "reactivated"> {
  const { rows: existing } = await pool.query(
    "SELECT id, status FROM patient_doctor WHERE doctor_id = $1 AND patient_id = $2",
    [doctorId, patientId]
  );

  if (existing.length > 0) {
    if (existing[0].status === "active") {
      return "already_linked";
    }
    await pool.query(
      "UPDATE patient_doctor SET status = 'active', assigned_at = NOW() WHERE id = $1",
      [existing[0].id]
    );
    return "reactivated";
  }

  await pool.query(
    "INSERT INTO patient_doctor (doctor_id, patient_id, status, assigned_at) VALUES ($1, $2, 'active', NOW())",
    [doctorId, patientId]
  );
  return "linked";
}

import pool from "@/lib/db";

export async function getDoctorId(userId: number): Promise<number | null> {
  const { rows } = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1",
    [userId]
  );
  return rows[0]?.id ?? null;
}

export async function listForDoctor(doctorId: number, upcoming: boolean) {
  const timeFilter = upcoming ? "AND a.scheduled_at >= NOW()" : "";
  const { rows } = await pool.query(`
    SELECT a.*, u.email as patient_email, u.first_name as patient_first_name, u.last_name as patient_last_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN users u ON u.id = p.user_id
    WHERE a.doctor_id = $1 ${timeFilter}
    ORDER BY a.scheduled_at ASC
  `, [doctorId]);
  return rows;
}

export async function listForPatient(patientId: number, upcoming: boolean) {
  const timeFilter = upcoming ? "AND a.scheduled_at >= NOW()" : "";
  const { rows } = await pool.query(`
    SELECT a.*, u.email as doctor_email, u.first_name as doctor_first_name, u.last_name as doctor_last_name
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    JOIN users u ON u.id = d.user_id
    WHERE a.patient_id = $1 ${timeFilter}
    ORDER BY a.scheduled_at ASC
  `, [patientId]);
  return rows;
}

export async function verifyDoctorPatientAccess(doctorId: number, patientId: number): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT 1 FROM patient_doctor WHERE doctor_id = $1 AND patient_id = $2 AND status = 'active'",
    [doctorId, patientId]
  );
  return rows.length > 0;
}

export async function create(input: {
  patientId: number;
  doctorId: number;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  type?: string;
  reason?: string;
  notes?: string;
}) {
  const { rows } = await pool.query(
    `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, location, type, reason, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      input.patientId, input.doctorId, input.scheduledAt,
      input.durationMinutes || 30, input.location || null,
      input.type || "in_person", input.reason || null, input.notes || null,
    ]
  );
  return rows[0];
}

export async function findById(id: number) {
  const { rows } = await pool.query("SELECT * FROM appointments WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function confirmByPatient(id: number) {
  await pool.query(
    "UPDATE appointments SET status = 'confirmed', updated_at = NOW() WHERE id = $1",
    [id]
  );
}

export async function update(id: number, fields: Record<string, unknown>) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const allowedFields = ["scheduled_at", "duration_minutes", "location", "type", "status", "reason", "notes"];
  for (const field of allowedFields) {
    if (fields[field] !== undefined) {
      updates.push(`${field} = $${idx++}`);
      values.push(fields[field]);
    }
  }

  if (updates.length === 0) return false;

  updates.push("updated_at = NOW()");
  values.push(id);

  await pool.query(
    `UPDATE appointments SET ${updates.join(", ")} WHERE id = $${idx}`,
    values
  );
  return true;
}

export async function cancel(id: number) {
  await pool.query(
    "UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
    [id]
  );
}

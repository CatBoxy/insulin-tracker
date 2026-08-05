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
  checkupTypeId?: number;
}) {
  const { rows } = await pool.query(
    `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, duration_minutes, location, type, reason, notes, checkup_type_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      input.patientId, input.doctorId, input.scheduledAt,
      input.durationMinutes || 30, input.location || null,
      input.type || "in_person", input.reason || null, input.notes || null,
      input.checkupTypeId || null,
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

const UPDATABLE_FIELDS = new Map([
  ["scheduled_at", "scheduled_at"],
  ["duration_minutes", "duration_minutes"],
  ["location", "location"],
  ["type", "type"],
  ["status", "status"],
  ["reason", "reason"],
  ["notes", "notes"],
  ["attendance_status", "attendance_status"],
] as const);

export async function update(id: number, fields: Record<string, unknown>) {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [inputKey, column] of UPDATABLE_FIELDS) {
    if (fields[inputKey] !== undefined) {
      values.push(fields[inputKey]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) return false;

  setClauses.push("updated_at = NOW()");
  values.push(id);

  await pool.query(
    `UPDATE appointments SET ${setClauses.join(", ")} WHERE id = $${values.length}`,
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

/**
 * When an appointment with a checkup_type_id is completed,
 * auto-insert a checkup_completions row (idempotent).
 */
export async function autoCompleteCheckup(appointmentId: number, completedByUserId: number) {
  const appt = await findById(appointmentId);
  if (!appt || !appt.checkup_type_id) return;

  // Find the patient_checkup for this patient + checkup_type
  const { rows: pcRows } = await pool.query(
    `SELECT id FROM patient_checkups
     WHERE patient_id = $1 AND checkup_type_id = $2 AND active = TRUE`,
    [appt.patient_id, appt.checkup_type_id]
  );
  if (pcRows.length === 0) return;

  const pcId = pcRows[0].id;
  const completedAt = appt.scheduled_at;

  // Idempotency: check for existing completion within ±24h
  const { rows: existing } = await pool.query(
    `SELECT id FROM checkup_completions
     WHERE patient_checkup_id = $1
       AND completed_at BETWEEN $2::timestamptz - INTERVAL '24 hours'
                            AND $2::timestamptz + INTERVAL '24 hours'`,
    [pcId, completedAt]
  );
  if (existing.length > 0) return;

  await pool.query(
    `INSERT INTO checkup_completions (patient_checkup_id, completed_at, appointment_id, reported_by_user_id)
     VALUES ($1, $2, $3, $4)`,
    [pcId, completedAt, appointmentId, completedByUserId]
  );
}

export async function listCheckupTypes() {
  const { rows } = await pool.query(
    "SELECT id, code, display_name_es FROM checkup_types ORDER BY sort_order"
  );
  return rows;
}

const VALID_ATTENDANCE = ["scheduled", "attended", "no_show", "cancelled_by_patient", "cancelled_by_clinic", "rescheduled"] as const;
export type AttendanceStatus = (typeof VALID_ATTENDANCE)[number];

export async function recordAttendance(
  appointmentId: number,
  status: AttendanceStatus,
  userId: number,
) {
  if (!VALID_ATTENDANCE.includes(status)) {
    throw new Error(`Invalid attendance status: ${status}`);
  }
  const { rowCount } = await pool.query(
    `UPDATE appointments
        SET attendance_status      = $1,
            attendance_recorded_at = NOW(),
            attendance_recorded_by = $2,
            updated_at             = NOW()
      WHERE id = $3`,
    [status, userId, appointmentId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Appointments older than 48 h whose attendance_status is still 'scheduled'.
 * Used by admin dashboard to surface unrecorded attendance.
 */
export async function getUnrecordedPastAppointments() {
  const { rows } = await pool.query(`
    SELECT a.id, a.scheduled_at, a.patient_id, a.doctor_id,
           u_p.first_name AS patient_first_name, u_p.last_name AS patient_last_name,
           u_d.first_name AS doctor_first_name, u_d.last_name AS doctor_last_name
    FROM appointments a
    JOIN patients p  ON p.id  = a.patient_id
    JOIN users   u_p ON u_p.id = p.user_id
    JOIN doctors d   ON d.id  = a.doctor_id
    JOIN users   u_d ON u_d.id = d.user_id
    WHERE a.attendance_status = 'scheduled'
      AND a.status != 'cancelled'
      AND a.scheduled_at < NOW() - INTERVAL '48 hours'
    ORDER BY a.scheduled_at ASC
  `);
  return rows;
}

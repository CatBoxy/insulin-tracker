import pool from "@/lib/db";

export async function getDoctorId(userId: number): Promise<number | null> {
  const { rows } = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1",
    [userId]
  );
  return rows[0]?.id ?? null;
}

export async function listPatients(doctorId: number) {
  const { rows } = await pool.query(`
    SELECT
      p.id as patient_id,
      u.id as user_id,
      u.email,
      u.first_name,
      u.last_name,
      p.date_of_birth,
      p.gender,
      pd.status as assignment_status,
      pd.assigned_at,
      CASE WHEN lg.value IS NOT NULL
        THEN json_build_object('value', lg.value, 'recorded_at', lg.recorded_at)
      END as latest_glucose,
      CASE WHEN lbp.value IS NOT NULL
        THEN json_build_object('value', lbp.value, 'notes', lbp.notes, 'recorded_at', lbp.recorded_at)
      END as latest_bp,
      CASE WHEN lw.value IS NOT NULL
        THEN json_build_object('value', lw.value, 'recorded_at', lw.recorded_at)
      END as latest_weight,
      COALESCE(ua.cnt, 0) as unread_alerts
    FROM patient_doctor pd
    JOIN patients p ON p.id = pd.patient_id
    JOIN users u ON u.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT m.value, m.recorded_at
      FROM measurements m
      WHERE m.patient_id = p.id AND m.type = 'glucemia'
      ORDER BY m.recorded_at DESC LIMIT 1
    ) lg ON true
    LEFT JOIN LATERAL (
      SELECT m.value, m.notes, m.recorded_at
      FROM measurements m
      WHERE m.patient_id = p.id AND m.type = 'blood_pressure'
      ORDER BY m.recorded_at DESC LIMIT 1
    ) lbp ON true
    LEFT JOIN LATERAL (
      SELECT m.value, m.recorded_at
      FROM measurements m
      WHERE m.patient_id = p.id AND m.type = 'weight'
      ORDER BY m.recorded_at DESC LIMIT 1
    ) lw ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as cnt
      FROM alerts a
      WHERE a.patient_id = p.id AND a.read = false
    ) ua ON true
    WHERE pd.doctor_id = $1 AND pd.status = 'active'
    ORDER BY u.last_name, u.email
  `, [doctorId]);
  return rows;
}

export async function verifyAccess(doctorId: number, patientId: number): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT 1 FROM patient_doctor WHERE doctor_id = $1 AND patient_id = $2 AND status = 'active'",
    [doctorId, patientId]
  );
  return rows.length > 0;
}

export async function getPatientDetail(patientId: number, doctorId: number) {
  const { rows: patientRows } = await pool.query(`
    SELECT p.*, u.email, u.first_name, u.last_name
    FROM patients p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = $1
  `, [patientId]);

  if (patientRows.length === 0) return null;

  const [measurements, alerts, prescriptions, appointments] = await Promise.all([
    pool.query(
      `SELECT id, type, value, unit, context, notes, recorded_at
       FROM measurements WHERE patient_id = $1
       ORDER BY recorded_at DESC LIMIT 500`,
      [patientId]
    ),
    pool.query(
      `SELECT id, type, severity, title, message, read, created_at
       FROM alerts WHERE patient_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [patientId]
    ),
    pool.query(
      `SELECT id, status, notes, created_at, signed_at, expires_at
       FROM prescriptions WHERE patient_id = $1 AND doctor_id = $2
       ORDER BY created_at DESC`,
      [patientId, doctorId]
    ),
    pool.query(
      `SELECT id, scheduled_at, duration_minutes, type, status, reason, notes, created_at
       FROM appointments WHERE patient_id = $1 AND doctor_id = $2
       ORDER BY scheduled_at DESC`,
      [patientId, doctorId]
    ),
  ]);

  return {
    patient: patientRows[0],
    measurements: measurements.rows,
    alerts: alerts.rows,
    prescriptions: prescriptions.rows,
    appointments: appointments.rows,
  };
}

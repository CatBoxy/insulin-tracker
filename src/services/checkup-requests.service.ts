import pool from "@/lib/db";

export async function createRequest(patientCheckupId: number, patientId: number) {
  // Find the patient's active doctor
  const { rows: doctorRows } = await pool.query(
    `SELECT doctor_id FROM patient_doctor
     WHERE patient_id = $1 AND status = 'active'
     LIMIT 1`,
    [patientId]
  );

  if (doctorRows.length === 0) {
    return { error: "no_doctor" as const };
  }

  const doctorId = doctorRows[0].doctor_id;

  // Check for existing pending request for this checkup
  const { rows: existing } = await pool.query(
    `SELECT id FROM checkup_requests
     WHERE patient_checkup_id = $1 AND status = 'pending'`,
    [patientCheckupId]
  );

  if (existing.length > 0) {
    return { error: "already_requested" as const };
  }

  const { rows } = await pool.query(
    `INSERT INTO checkup_requests (patient_checkup_id, patient_id, doctor_id)
     VALUES ($1, $2, $3) RETURNING id, created_at`,
    [patientCheckupId, patientId, doctorId]
  );

  return { id: rows[0].id, created_at: rows[0].created_at };
}

export async function listForDoctor(doctorId: number) {
  const { rows } = await pool.query(
    `SELECT
       cr.id,
       cr.patient_checkup_id,
       cr.patient_id,
       cr.status,
       cr.created_at,
       ct.code AS checkup_code,
       ct.display_name_es AS checkup_name,
       ct.category AS checkup_category,
       u.first_name AS patient_first_name,
       u.last_name AS patient_last_name,
       u.email AS patient_email
     FROM checkup_requests cr
     JOIN patient_checkups pc ON pc.id = cr.patient_checkup_id
     JOIN checkup_types ct ON ct.id = pc.checkup_type_id
     JOIN patients p ON p.id = cr.patient_id
     JOIN users u ON u.id = p.user_id
     WHERE cr.doctor_id = $1 AND cr.status = 'pending'
     ORDER BY cr.created_at DESC`,
    [doctorId]
  );
  return rows;
}

export async function countPendingForDoctor(doctorId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM checkup_requests
     WHERE doctor_id = $1 AND status = 'pending'`,
    [doctorId]
  );
  return rows[0].count;
}

export async function hasPendingRequest(patientCheckupId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM checkup_requests
     WHERE patient_checkup_id = $1 AND status = 'pending'
     LIMIT 1`,
    [patientCheckupId]
  );
  return rows.length > 0;
}

export async function listPendingByPatientCheckupIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT patient_checkup_id FROM checkup_requests
     WHERE patient_checkup_id = ANY($1) AND status = 'pending'`,
    [ids]
  );
  return rows.map(r => r.patient_checkup_id);
}

export async function markSeen(requestId: number, doctorId: number) {
  const { rowCount } = await pool.query(
    `UPDATE checkup_requests
     SET status = 'seen', seen_at = NOW()
     WHERE id = $1 AND doctor_id = $2 AND status = 'pending'`,
    [requestId, doctorId]
  );
  return rowCount !== null && rowCount > 0;
}

export async function markSeenBatch(requestIds: number[], doctorId: number) {
  await pool.query(
    `UPDATE checkup_requests
     SET status = 'seen', seen_at = NOW()
     WHERE id = ANY($1) AND doctor_id = $2 AND status = 'pending'`,
    [requestIds, doctorId]
  );
}

import pool from "@/lib/db";

export async function getByPatient(patientId: number) {
  const { rows } = await pool.query(
    `SELECT lr.id, lr.patient_id, lr.timepoint, lr.collected_on, lr.analyte, lr.value, lr.unit,
            lr.source, lr.verified_by, lr.verified_at, lr.attachment_id,
            u.first_name AS verified_by_first_name, u.last_name AS verified_by_last_name
     FROM lab_results lr
     LEFT JOIN users u ON u.id = lr.verified_by
     WHERE lr.patient_id = $1
     ORDER BY lr.collected_on DESC, lr.analyte`,
    [patientId]
  );
  return rows;
}

export async function getByPatientAndTimepoint(patientId: number, timepoint: string) {
  const { rows } = await pool.query(
    `SELECT lr.id, lr.patient_id, lr.timepoint, lr.collected_on, lr.analyte, lr.value, lr.unit,
            lr.source, lr.verified_by, lr.verified_at, lr.attachment_id,
            u.first_name AS verified_by_first_name, u.last_name AS verified_by_last_name
     FROM lab_results lr
     LEFT JOIN users u ON u.id = lr.verified_by
     WHERE lr.patient_id = $1 AND lr.timepoint = $2
     ORDER BY lr.collected_on DESC, lr.analyte`,
    [patientId, timepoint]
  );
  return rows;
}

export async function createManual(
  patientId: number,
  timepoint: string,
  collectedOn: string,
  analyte: string,
  value: number,
  unit: string,
  doctorUserId: number
) {
  const { rows } = await pool.query(
    `INSERT INTO lab_results (patient_id, timepoint, collected_on, analyte, value, unit, source, verified_by, verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7, NOW())
     ON CONFLICT (patient_id, timepoint, analyte, collected_on)
     DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit, source = EXCLUDED.source,
                   verified_by = EXCLUDED.verified_by, verified_at = NOW()
     RETURNING *`,
    [patientId, timepoint, collectedOn, analyte, value, unit, doctorUserId]
  );
  return rows[0];
}

export async function createFromParse(
  patientId: number,
  timepoint: string,
  collectedOn: string,
  analyte: string,
  value: number,
  unit: string,
  attachmentId: number
) {
  const { rows } = await pool.query(
    `INSERT INTO lab_results (patient_id, timepoint, collected_on, analyte, value, unit, source, attachment_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'parsed', $7)
     ON CONFLICT (patient_id, timepoint, analyte, collected_on)
     DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit, source = EXCLUDED.source,
                   attachment_id = EXCLUDED.attachment_id, verified_by = NULL, verified_at = NULL
     RETURNING *`,
    [patientId, timepoint, collectedOn, analyte, value, unit, attachmentId]
  );
  return rows[0];
}

export async function verify(labResultId: number, doctorUserId: number) {
  const { rows } = await pool.query(
    `UPDATE lab_results SET verified_by = $2, verified_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [labResultId, doctorUserId]
  );
  return rows[0] ?? null;
}

export async function bulkVerify(labResultIds: number[], doctorUserId: number) {
  if (labResultIds.length === 0) return [];
  const placeholders = labResultIds.map((_, i) => `$${i + 1}`).join(",");
  const { rows } = await pool.query(
    `UPDATE lab_results SET verified_by = $${labResultIds.length + 1}, verified_at = NOW()
     WHERE id IN (${placeholders})
     RETURNING *`,
    [...labResultIds, doctorUserId]
  );
  return rows;
}

export async function getUnverified(patientId?: number) {
  const condition = patientId
    ? "WHERE lr.verified_by IS NULL AND lr.patient_id = $1"
    : "WHERE lr.verified_by IS NULL";
  const params = patientId ? [patientId] : [];

  const { rows } = await pool.query(
    `SELECT lr.id, lr.patient_id, lr.timepoint, lr.collected_on, lr.analyte, lr.value, lr.unit,
            lr.source, lr.attachment_id,
            p.first_name AS patient_first_name, p.last_name AS patient_last_name
     FROM lab_results lr
     JOIN patients pt ON pt.id = lr.patient_id
     JOIN users p ON p.id = pt.user_id
     ${condition}
     ORDER BY lr.collected_on DESC, lr.analyte`,
    params
  );
  return rows;
}

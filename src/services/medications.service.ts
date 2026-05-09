import pool from "@/lib/db";

export async function listForPatient(patientId: number) {
  const { rows } = await pool.query(`
    SELECT pi.id, pi.medication_name as name, pi.dosage, pi.frequency, pi.instructions,
           p.status, p.expires_at
    FROM prescriptions p
    JOIN prescription_items pi ON pi.prescription_id = p.id
    WHERE p.patient_id = $1 AND p.status = 'active'
    ORDER BY pi.medication_name
  `, [patientId]);
  return rows;
}

export async function listForPatientDetailed(patientId: number) {
  const { rows } = await pool.query(
    `SELECT p.id, p.status, p.notes, p.created_at, p.expires_at,
            pi.medication_name, pi.dosage, pi.frequency, pi.instructions
     FROM prescriptions p
     JOIN prescription_items pi ON pi.prescription_id = p.id
     WHERE p.patient_id = $1 AND p.status = 'active'
     ORDER BY p.created_at DESC`,
    [patientId]
  );
  return rows;
}

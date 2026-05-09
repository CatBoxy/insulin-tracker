import pool from "@/lib/db";
import { checkAndCreateRefillAlerts } from "@/lib/refill-alerts";

export async function listUnread(patientId: number) {
  const { rows } = await pool.query(
    "SELECT id, type, severity, title, message, created_at FROM alerts WHERE patient_id = $1 AND read = false ORDER BY created_at DESC LIMIT 10",
    [patientId]
  );
  return rows;
}

export async function listByPatient(patientId: number) {
  const { rows } = await pool.query(
    `SELECT id, patient_id, type, severity, title, message, read, created_at
     FROM alerts
     WHERE patient_id = $1 AND read = FALSE
     ORDER BY created_at DESC`,
    [patientId]
  );
  return rows;
}

export async function dismissBatch(alertIds: number[], patientId: number) {
  await pool.query(
    "UPDATE alerts SET read = true, read_at = NOW() WHERE id = ANY($1) AND patient_id = $2",
    [alertIds, patientId]
  );
}

export async function dismissOne(alertId: number) {
  await pool.query(
    "UPDATE alerts SET read = TRUE, read_at = NOW() WHERE id = $1",
    [alertId]
  );
}

export async function findById(alertId: number) {
  const { rows } = await pool.query(
    "SELECT id, patient_id FROM alerts WHERE id = $1",
    [alertId]
  );
  return rows[0] ?? null;
}

export async function checkInactivityAndCritical() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created: { patient_id: number; type: string }[] = [];

    const { rows: inactivityRows } = await client.query(`
      INSERT INTO alerts (patient_id, type, severity, title, message)
      SELECT p.id, 'missed_logging', 'warning',
        'Sin registros recientes',
        'El paciente ' || u.email || ' no ha registrado glucemia en más de 7 días.'
      FROM patients p
      JOIN users u ON u.id = p.user_id
      WHERE u.role = 'patient'
        AND EXISTS (
          SELECT 1 FROM measurements m
          WHERE m.patient_id = p.id AND m.type = 'glucemia'
        )
        AND NOT EXISTS (
          SELECT 1 FROM measurements m
          WHERE m.patient_id = p.id
            AND m.type = 'glucemia'
            AND m.recorded_at > NOW() - INTERVAL '7 days'
        )
        AND NOT EXISTS (
          SELECT 1 FROM alerts a
          WHERE a.patient_id = p.id
            AND a.type = 'missed_logging'
            AND a.read = FALSE
        )
      RETURNING patient_id, type
    `);
    created.push(...inactivityRows);

    const { rows: abnormalRows } = await client.query(`
      INSERT INTO alerts (patient_id, type, severity, title, message)
      SELECT DISTINCT a.patient_id, 'custom', 'critical',
        'Consulta necesaria',
        'El paciente tiene alertas críticas sin atender que requieren consulta.'
      FROM alerts a
      WHERE a.severity = 'critical'
        AND a.read = FALSE
        AND a.created_at > NOW() - INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM alerts a2
          WHERE a2.patient_id = a.patient_id
            AND a2.type = 'custom'
            AND a2.title = 'Consulta necesaria'
            AND a2.read = FALSE
        )
      RETURNING patient_id, type
    `);
    created.push(...abnormalRows);

    await client.query("COMMIT");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { checkAndCreateRefillAlerts };

import pool from "@/lib/db";
import crypto from "crypto";

function generateCode(): string {
  return crypto.randomBytes(6).toString("hex").slice(0, 8).toUpperCase();
}

export async function generateParticipantCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const { rows } = await pool.query(
      "SELECT 1 FROM study_participants WHERE participant_code = $1",
      [code]
    );
    if (rows.length === 0) return code;
  }
  throw new Error("Failed to generate unique participant code after 10 attempts");
}

export async function enroll(input: {
  patientId: number;
  arm: "intervention" | "control";
  consentVersion: string;
  consentSignedAt: string;
  baselineHba1c?: number;
  enrolledBy: number;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const code = await generateParticipantCode();

    const { rows } = await client.query(
      `INSERT INTO study_participants
        (patient_id, participant_code, arm, consent_version, consent_signed_at, baseline_hba1c)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.patientId,
        code,
        input.arm,
        input.consentVersion,
        input.consentSignedAt,
        input.baselineHba1c ?? null,
      ]
    );

    const participant = rows[0];

    await client.query(
      `INSERT INTO study_arm_audit
        (participant_id, old_arm, new_arm, changed_by, reason)
       VALUES ($1, NULL, $2, $3, $4)`,
      [participant.id, input.arm, input.enrolledBy, "Initial enrollment"]
    );

    await client.query("COMMIT");
    return participant;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function changeArm(
  participantId: number,
  newArm: "intervention" | "control",
  changedBy: number,
  reason: string
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: current } = await client.query(
      "SELECT arm FROM study_participants WHERE id = $1",
      [participantId]
    );
    if (current.length === 0) throw new Error("Participant not found");

    const oldArm = current[0].arm;

    await client.query(
      "UPDATE study_participants SET arm = $1 WHERE id = $2",
      [newArm, participantId]
    );

    await client.query(
      `INSERT INTO study_arm_audit
        (participant_id, old_arm, new_arm, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [participantId, oldArm, newArm, changedBy, reason]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function withdraw(
  participantId: number,
  reason: string,
  withdrawnBy: number
) {
  const { rowCount } = await pool.query(
    `UPDATE study_participants
     SET withdrawn_at = now(), withdrawal_reason = $1
     WHERE id = $2 AND withdrawn_at IS NULL`,
    [reason, participantId]
  );
  if (rowCount === 0) throw new Error("Participant not found or already withdrawn");
}

export async function getByPatientId(patientId: number) {
  const { rows } = await pool.query(
    "SELECT * FROM study_participants WHERE patient_id = $1",
    [patientId]
  );
  return rows[0] ?? null;
}

export async function getByCode(code: string) {
  const { rows } = await pool.query(
    "SELECT * FROM study_participants WHERE participant_code = $1",
    [code]
  );
  return rows[0] ?? null;
}

export async function listAll() {
  const { rows } = await pool.query(`
    SELECT sp.*, u.first_name, u.last_name, u.email
    FROM study_participants sp
    JOIN patients p ON p.id = sp.patient_id
    JOIN users u ON u.id = p.user_id
    ORDER BY sp.enrolled_at DESC
  `);
  return rows;
}

export async function logScreening(
  patientId: number | null,
  eligible: boolean,
  reason: string | null,
  screenedBy: number
) {
  const { rows } = await pool.query(
    `INSERT INTO study_screening_log (patient_id, eligible, reason, screened_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [patientId, eligible, reason, screenedBy]
  );
  return rows[0];
}

export async function logIncident(
  participantId: number,
  occurredOn: string,
  kind: string,
  description: string,
  recordedBy: number
) {
  const { rows } = await pool.query(
    `INSERT INTO study_incidents (participant_id, occurred_on, kind, description, recorded_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [participantId, occurredOn, kind, description, recordedBy]
  );
  return rows[0];
}

export async function getAuditHistory(participantId: number) {
  const { rows } = await pool.query(
    `SELECT a.*, u.first_name, u.last_name, u.email
     FROM study_arm_audit a
     JOIN users u ON u.id = a.changed_by
     WHERE a.participant_id = $1
     ORDER BY a.changed_at ASC`,
    [participantId]
  );
  return rows;
}

export async function getScreeningLog() {
  const { rows } = await pool.query(`
    SELECT sl.*, u_screener.first_name as screener_first_name, u_screener.last_name as screener_last_name,
           u_patient.first_name as patient_first_name, u_patient.last_name as patient_last_name
    FROM study_screening_log sl
    LEFT JOIN users u_screener ON u_screener.id = sl.screened_by
    LEFT JOIN patients p ON p.id = sl.patient_id
    LEFT JOIN users u_patient ON u_patient.id = p.user_id
    ORDER BY sl.screened_at DESC
  `);
  return rows;
}

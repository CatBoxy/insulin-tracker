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

export async function getNextAllocation(): Promise<{ arm: "intervention" | "control"; sequence: number }> {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS total FROM study_participants"
  );
  const total: number = rows[0].total;
  const sequence = total + 1;
  // Even sequence -> intervention, odd sequence -> control
  const arm: "intervention" | "control" = sequence % 2 === 0 ? "control" : "intervention";
  return { arm, sequence };
}

export async function enroll(input: {
  patientId: number;
  arm?: "intervention" | "control";
  consentVersion: string;
  consentSignedAt: string;
  baselineHba1c?: number;
  enrolledBy: number;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const code = await generateParticipantCode();

    const isManual = !!input.arm;
    let assignedArm: "intervention" | "control";
    let allocationSequence: number;

    if (isManual) {
      assignedArm = input.arm!;
      // Still compute the sequence for record-keeping
      const { rows: countRows } = await client.query(
        "SELECT COUNT(*)::int AS total FROM study_participants"
      );
      allocationSequence = countRows[0].total + 1;
    } else {
      const allocation = await getNextAllocation();
      assignedArm = allocation.arm;
      allocationSequence = allocation.sequence;
    }

    const allocationMethod = isManual ? "manual" : "alternating";

    const { rows } = await client.query(
      `INSERT INTO study_participants
        (patient_id, participant_code, arm, consent_version, consent_signed_at, baseline_hba1c,
         allocation_method, allocation_sequence, allocated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        input.patientId,
        code,
        assignedArm,
        input.consentVersion,
        input.consentSignedAt,
        input.baselineHba1c ?? null,
        allocationMethod,
        allocationSequence,
      ]
    );

    const participant = rows[0];

    const auditReason = isManual
      ? "Manual assignment at enrollment"
      : "Initial enrollment (auto-allocated)";

    await client.query(
      `INSERT INTO study_arm_audit
        (participant_id, old_arm, new_arm, changed_by, reason)
       VALUES ($1, NULL, $2, $3, $4)`,
      [participant.id, assignedArm, input.enrolledBy, auditReason]
    );

    // Auto-create 3 study visits (baseline, month_3, month_6)
    const enrollmentDate = new Date(input.consentSignedAt);
    const month3 = new Date(enrollmentDate);
    month3.setMonth(month3.getMonth() + 3);
    const month6 = new Date(enrollmentDate);
    month6.setMonth(month6.getMonth() + 6);

    const visits = [
      { type: "baseline", date: enrollmentDate.toISOString().split("T")[0] },
      { type: "month_3", date: month3.toISOString().split("T")[0] },
      { type: "month_6", date: month6.toISOString().split("T")[0] },
    ];

    for (const v of visits) {
      await client.query(
        `INSERT INTO study_visits (participant_id, visit_type, scheduled_date)
         VALUES ($1, $2, $3)`,
        [participant.id, v.type, v.date]
      );
    }

    await client.query("COMMIT");
    return participant;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listVisits(participantId: number) {
  const { rows } = await pool.query(
    `SELECT sv.*, d_user.first_name AS performed_by_first_name, d_user.last_name AS performed_by_last_name
     FROM study_visits sv
     LEFT JOIN doctors d ON d.id = sv.performed_by
     LEFT JOIN users d_user ON d_user.id = d.user_id
     WHERE sv.participant_id = $1
     ORDER BY CASE sv.visit_type WHEN 'baseline' THEN 1 WHEN 'month_3' THEN 2 WHEN 'month_6' THEN 3 END`,
    [participantId]
  );
  return rows;
}

export async function recordVisit(
  visitId: number,
  performedDate: string,
  doctorId: number,
  notes?: string
) {
  const { rows } = await pool.query(
    `UPDATE study_visits SET performed_date = $1, performed_by = $2, notes = COALESCE($3, notes)
     WHERE id = $4
     RETURNING *`,
    [performedDate, doctorId, notes ?? null, visitId]
  );
  if (rows.length === 0) throw new Error("Visit not found");
  return rows[0];
}

export async function getOpenVisits(participantId: number) {
  const { rows } = await pool.query(
    `SELECT * FROM study_visits
     WHERE participant_id = $1 AND performed_date IS NULL
     ORDER BY CASE visit_type WHEN 'baseline' THEN 1 WHEN 'month_3' THEN 2 WHEN 'month_6' THEN 3 END`,
    [participantId]
  );
  return rows;
}

export async function getVisitsByPatientId(patientId: number) {
  const { rows } = await pool.query(
    `SELECT sv.*
     FROM study_visits sv
     JOIN study_participants sp ON sp.id = sv.participant_id
     WHERE sp.patient_id = $1
     ORDER BY CASE sv.visit_type WHEN 'baseline' THEN 1 WHEN 'month_3' THEN 2 WHEN 'month_6' THEN 3 END`,
    [patientId]
  );
  return rows;
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

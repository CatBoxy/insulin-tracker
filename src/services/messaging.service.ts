/**
 * Messaging arm enforcement gate.
 *
 * Every message send path MUST call checkArmGate() before sending.
 * This is the single guard that prevents control-arm patients from
 * ever receiving an intervention message.
 *
 * Design invariants:
 * - Reads the arm from the database at call time — never from cache or job payload.
 * - Returns { allowed: true, participant } or { allowed: false, reason }.
 * - Every refusal is logged to message_send_refusals (never silently dropped).
 * - This function is imported by the scheduler, manual sender, retry logic,
 *   and admin tools — it must be self-contained.
 */

import pool from "@/lib/db";

export interface StudyParticipant {
  id: number;
  patient_id: number;
  participant_code: string;
  arm: "intervention" | "control";
  enrolled_at: string;
  consent_version: string;
  consent_signed_at: string;
  baseline_hba1c: number | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
}

type GateResult =
  | { allowed: true; participant: StudyParticipant }
  | { allowed: false; reason: string };

/**
 * Log a send refusal to the message_send_refusals table.
 * Every refusal is recorded — no silent drops.
 */
async function logRefusal(
  patientId: number,
  reason: string
): Promise<void> {
  await pool.query(
    `INSERT INTO message_send_refusals (patient_id, reason) VALUES ($1, $2)`,
    [patientId, reason]
  );
}

/**
 * The arm enforcement gate.
 *
 * Call this before every message send — scheduled, manual, retry, batch,
 * admin-triggered. No exceptions.
 *
 * Queries study_participants by patient_id at call time (never cached).
 * Refuses if the patient is:
 *   - not enrolled in the study
 *   - assigned to the control arm
 *   - withdrawn from the study
 *
 * On refusal the reason is persisted to message_send_refusals and returned
 * to the caller so it can decide how to handle it (abort, skip, alert, etc.).
 *
 * On success the full StudyParticipant row is returned so callers can use
 * participant_code, arm, baseline data, etc. without a second query.
 */
export async function checkArmGate(patientId: number): Promise<GateResult> {
  // Always read from the database — never trust a cached or payload value.
  const { rows } = await pool.query<StudyParticipant>(
    "SELECT * FROM study_participants WHERE patient_id = $1",
    [patientId]
  );

  const participant = rows[0] ?? null;

  if (!participant) {
    const reason = "Patient is not enrolled in the study";
    await logRefusal(patientId, reason);
    return { allowed: false, reason };
  }

  if (participant.withdrawn_at !== null) {
    const reason = `Participant ${participant.participant_code} has been withdrawn from the study`;
    await logRefusal(patientId, reason);
    return { allowed: false, reason };
  }

  if (participant.arm === "control") {
    const reason = `Participant ${participant.participant_code} is in the control arm`;
    await logRefusal(patientId, reason);
    return { allowed: false, reason };
  }

  // Only active, non-withdrawn, intervention-arm participants pass.
  return { allowed: true, participant };
}

import pool from "@/lib/db";

/**
 * Update last_interaction_at and conditionally insert an app_session row.
 * A new session is only inserted if the last one for this patient+channel
 * was more than 30 minutes ago (debounce against page refreshes).
 */
export async function recordInteraction(
  patientId: number,
  channel: "web" | "mobile"
) {
  await pool.query(
    "UPDATE patients SET last_interaction_at = NOW() WHERE id = $1",
    [patientId]
  );

  await pool.query(
    `INSERT INTO app_sessions (patient_id, channel)
     SELECT $1, $2
     WHERE NOT EXISTS (
       SELECT 1 FROM app_sessions
       WHERE patient_id = $1
         AND channel = $2
         AND started_at > NOW() - INTERVAL '30 minutes'
     )`,
    [patientId, channel]
  );
}

/**
 * Returns active days (days with at least one session) and total session
 * count for a patient within a date range.
 */
export async function getWeeklyMetrics(
  patientId: number,
  from: string,
  to: string
): Promise<{ activeDays: number; sessionCount: number }> {
  const { rows } = await pool.query(
    `SELECT
       COUNT(DISTINCT started_at::date) AS active_days,
       COUNT(*)::int AS session_count
     FROM app_sessions
     WHERE patient_id = $1
       AND started_at >= $2::timestamptz
       AND started_at < $3::timestamptz`,
    [patientId, from, to]
  );

  return {
    activeDays: parseInt(rows[0].active_days, 10) || 0,
    sessionCount: parseInt(rows[0].session_count, 10) || 0,
  };
}

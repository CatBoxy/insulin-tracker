// Weekly self-monitoring: complete 7-day windows counted forward from
// enrollment date. Partial trailing weeks are is_complete_week=false
// and must be reported separately, never averaged in.
// This is the ONLY implementation — do not duplicate this computation.

import pool from "@/lib/db";

export interface WeeklySelfMonitoringRow {
  participant_code: string;
  week_number: number;
  week_start: string; // ISO date
  week_end: string;   // ISO date
  hemoglucotests: number;
  bp_checks: number;
  is_complete_week: boolean;
}

/**
 * Returns weekly self-monitoring counts for a single participant.
 *
 * Windows are 7-day periods counted forward from the participant's
 * enrolled_at date. The last window may be incomplete (still open).
 */
export async function getWeeklySelfMonitoring(
  participantCode: string
): Promise<WeeklySelfMonitoringRow[]> {
  const { rows } = await pool.query<WeeklySelfMonitoringRow>(
    `
    WITH participant AS (
      SELECT sp.participant_code, sp.patient_id, sp.enrolled_at::date AS start_date
      FROM study_participants sp
      WHERE sp.participant_code = $1
    ),
    weeks AS (
      SELECT
        p.participant_code,
        p.patient_id,
        row_number() OVER (ORDER BY w.week_start) AS week_number,
        w.week_start::date AS week_start,
        (w.week_start + interval '6 days')::date AS week_end
      FROM participant p,
        generate_series(
          p.start_date,
          CURRENT_DATE,
          interval '7 days'
        ) AS w(week_start)
    )
    SELECT
      w.participant_code,
      w.week_number::int,
      w.week_start::text AS week_start,
      w.week_end::text AS week_end,
      COALESCE(SUM(CASE WHEN m.type = 'glucemia' THEN 1 ELSE 0 END), 0)::int AS hemoglucotests,
      COALESCE(SUM(CASE WHEN m.type = 'blood_pressure' THEN 1 ELSE 0 END), 0)::int AS bp_checks,
      (w.week_end <= CURRENT_DATE) AS is_complete_week
    FROM weeks w
    LEFT JOIN measurements m
      ON m.patient_id = w.patient_id
      AND m.recorded_at::date >= w.week_start
      AND m.recorded_at::date <= w.week_end
    GROUP BY w.participant_code, w.week_number, w.week_start, w.week_end
    ORDER BY w.week_number
    `,
    [participantCode]
  );

  return rows;
}

/**
 * Returns weekly self-monitoring counts for ALL enrolled participants.
 * Intended for the analysis/export view.
 */
export async function getWeeklySelfMonitoringAll(): Promise<WeeklySelfMonitoringRow[]> {
  const { rows } = await pool.query<WeeklySelfMonitoringRow>(
    `
    WITH participants AS (
      SELECT sp.participant_code, sp.patient_id, sp.enrolled_at::date AS start_date
      FROM study_participants sp
      WHERE sp.withdrawn_at IS NULL
    ),
    weeks AS (
      SELECT
        p.participant_code,
        p.patient_id,
        row_number() OVER (PARTITION BY p.participant_code ORDER BY w.week_start) AS week_number,
        w.week_start::date AS week_start,
        (w.week_start + interval '6 days')::date AS week_end
      FROM participants p,
        LATERAL generate_series(
          p.start_date,
          CURRENT_DATE,
          interval '7 days'
        ) AS w(week_start)
    )
    SELECT
      w.participant_code,
      w.week_number::int,
      w.week_start::text AS week_start,
      w.week_end::text AS week_end,
      COALESCE(SUM(CASE WHEN m.type = 'glucemia' THEN 1 ELSE 0 END), 0)::int AS hemoglucotests,
      COALESCE(SUM(CASE WHEN m.type = 'blood_pressure' THEN 1 ELSE 0 END), 0)::int AS bp_checks,
      (w.week_end <= CURRENT_DATE) AS is_complete_week
    FROM weeks w
    LEFT JOIN measurements m
      ON m.patient_id = w.patient_id
      AND m.recorded_at::date >= w.week_start
      AND m.recorded_at::date <= w.week_end
    GROUP BY w.participant_code, w.week_number, w.week_start, w.week_end
    ORDER BY w.participant_code, w.week_number
    `
  );

  return rows;
}

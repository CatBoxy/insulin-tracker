import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import pool from "@/lib/db";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    // Counts by arm and status
    const { rows: countRows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE arm = 'intervention' AND withdrawn_at IS NULL)::int AS intervention_active,
        COUNT(*) FILTER (WHERE arm = 'control' AND withdrawn_at IS NULL)::int AS control_active,
        COUNT(*) FILTER (WHERE withdrawn_at IS NOT NULL)::int AS withdrawn
      FROM study_participants
    `);

    const counts = countRows[0];

    // Participants with no activity in last 7 days:
    // no measurements AND no app_sessions in the last 7 days
    const { rows: inactive } = await pool.query(`
      SELECT
        sp.participant_code,
        sp.arm,
        u.first_name,
        u.last_name,
        GREATEST(
          (SELECT MAX(m.recorded_at) FROM measurements m WHERE m.patient_id = sp.patient_id),
          (SELECT MAX(s.started_at) FROM app_sessions s WHERE s.patient_id = sp.patient_id)
        ) AS last_activity
      FROM study_participants sp
      JOIN patients p ON p.id = sp.patient_id
      JOIN users u ON u.id = p.user_id
      WHERE sp.withdrawn_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM measurements m
          WHERE m.patient_id = sp.patient_id
            AND m.recorded_at > NOW() - INTERVAL '7 days'
        )
        AND NOT EXISTS (
          SELECT 1 FROM app_sessions s
          WHERE s.patient_id = sp.patient_id
            AND s.started_at > NOW() - INTERVAL '7 days'
        )
      ORDER BY last_activity ASC NULLS FIRST
    `);

    // Enrollment progress over time (per month)
    const { rows: enrollmentProgress } = await pool.query(`
      SELECT
        TO_CHAR(enrolled_at, 'YYYY-MM') AS month,
        COUNT(*)::int AS enrolled,
        COUNT(*) FILTER (WHERE arm = 'intervention')::int AS intervention,
        COUNT(*) FILTER (WHERE arm = 'control')::int AS control
      FROM study_participants
      GROUP BY TO_CHAR(enrolled_at, 'YYYY-MM')
      ORDER BY month
    `);

    return NextResponse.json({
      total: counts.total,
      interventionActive: counts.intervention_active,
      controlActive: counts.control_active,
      withdrawn: counts.withdrawn,
      inactive,
      enrollmentProgress,
    });
  } catch (error) {
    console.error("GET /api/admin/study/dashboard error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

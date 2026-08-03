import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { enrollParticipantSchema } from "@/lib/validation";
import * as studyService from "@/services/study.service";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const parsed = enrollParticipantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { patientId, arm, consentVersion, consentSignedAt, baselineHba1c } = parsed.data;

    // Verify patient was screened as eligible
    const { rows: screeningRows } = await pool.query(
      `SELECT id, eligible FROM study_screening_log
       WHERE patient_id = $1
       ORDER BY screened_at DESC
       LIMIT 1`,
      [patientId]
    );

    if (screeningRows.length === 0) {
      return NextResponse.json({ error: "El paciente no ha sido evaluado. Realice la evaluación de elegibilidad primero." }, { status: 400 });
    }

    if (!screeningRows[0].eligible) {
      return NextResponse.json({ error: "El paciente no es elegible para el estudio." }, { status: 400 });
    }

    // Check if already enrolled
    const existing = await studyService.getByPatientId(patientId);
    if (existing) {
      return NextResponse.json({ error: "El paciente ya está inscrito en el estudio." }, { status: 409 });
    }

    const participant = await studyService.enroll({
      patientId,
      arm,
      consentVersion,
      consentSignedAt,
      baselineHba1c,
      enrolledBy: user.id,
    });

    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/study/enroll error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

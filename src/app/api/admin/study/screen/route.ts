import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { screeningSchema } from "@/lib/validation";
import * as studyService from "@/services/study.service";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const parsed = screeningSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { patientId, reason } = parsed.data;

    // Get patient DOB to compute age
    const { rows: patientRows } = await pool.query(
      `SELECT p.id, p.date_of_birth, u.first_name, u.last_name
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [patientId]
    );

    if (patientRows.length === 0) {
      return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    }

    const patient = patientRows[0];
    let eligible = parsed.data.eligible;
    let finalReason = reason ?? null;

    // Auto-check age eligibility
    if (patient.date_of_birth) {
      const dob = new Date(patient.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 60) {
        eligible = false;
        finalReason = "No elegible: menor de 60 años";
      }
    } else {
      // No DOB on file — cannot verify age
      eligible = false;
      finalReason = finalReason || "No elegible: fecha de nacimiento no registrada";
    }

    const screening = await studyService.logScreening(patientId, eligible, finalReason, user.id);

    return NextResponse.json({
      screening,
      eligible,
      reason: finalReason,
      patient: { id: patient.id, first_name: patient.first_name, last_name: patient.last_name },
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/study/screen error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

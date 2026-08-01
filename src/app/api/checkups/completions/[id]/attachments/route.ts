import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as attachmentsService from "@/services/attachments.service";
import * as appointmentsService from "@/services/appointments.service";
import pool from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const completionId = parseInt(id, 10);
    if (isNaN(completionId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    // Verify this completion belongs to the user's patient (or the user is a doctor with access)
    const { rows } = await pool.query(
      `SELECT pc.patient_id FROM checkup_completions cc
       JOIN patient_checkups pc ON pc.id = cc.patient_checkup_id
       WHERE cc.id = $1`,
      [completionId]
    );
    if (rows.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const completionPatientId = rows[0].patient_id;
    const patientId = await resolvePatientId(user.id);

    if (patientId !== completionPatientId && user.role !== "admin") {
      if (user.role === "doctor") {
        const doctorId = await appointmentsService.getDoctorId(user.id);
        if (!doctorId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        const hasAccess = await appointmentsService.verifyDoctorPatientAccess(doctorId, completionPatientId);
        if (!hasAccess) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const attachments = await attachmentsService.listByCompletion(completionId);
    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("GET /api/checkups/completions/[id]/attachments error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const completionId = parseInt(id, 10);
    if (isNaN(completionId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const { rows } = await pool.query(
      `SELECT pc.patient_id FROM checkup_completions cc
       JOIN patient_checkups pc ON pc.id = cc.patient_checkup_id
       WHERE cc.id = $1`,
      [completionId]
    );
    if (rows.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const completionPatientId = rows[0].patient_id;
    const patientId = await resolvePatientId(user.id);

    if (patientId !== completionPatientId && user.role !== "admin") {
      if (user.role === "doctor") {
        const doctorId = await appointmentsService.getDoctorId(user.id);
        if (!doctorId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        const hasAccess = await appointmentsService.verifyDoctorPatientAccess(doctorId, completionPatientId);
        if (!hasAccess) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    if (files.length === 0) return NextResponse.json({ error: "No se enviaron archivos" }, { status: 400 });

    const validationError = attachmentsService.validateFiles(files);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const attachments = await attachmentsService.uploadAndAttach(completionId, files, user.id);
    return NextResponse.json({ attachments }, { status: 201 });
  } catch (error) {
    console.error("POST /api/checkups/completions/[id]/attachments error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

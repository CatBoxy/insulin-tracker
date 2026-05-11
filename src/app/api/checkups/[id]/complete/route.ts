import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { completeCheckupSchema } from "@/lib/validation";
import * as checkupsService from "@/services/checkups.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const { id } = await params;
    const checkupId = parseInt(id, 10);
    if (isNaN(checkupId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const checkup = await checkupsService.findById(checkupId);
    if (!checkup || checkup.patient_id !== patientId || !checkup.active) {
      return NextResponse.json({ error: "Control no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = completeCheckupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Reject future dates
    if (new Date(parsed.data.completed_at) > new Date()) {
      return NextResponse.json({ error: "No se puede registrar una fecha futura" }, { status: 400 });
    }

    const result = await checkupsService.completeCheckup(
      checkupId,
      parsed.data.completed_at,
      user.id,
      parsed.data.notes
    );

    if (result.conflict) {
      return NextResponse.json({ error: "Ya existe un registro cercano a esa fecha" }, { status: 409 });
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("POST /api/checkups/[id]/complete error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

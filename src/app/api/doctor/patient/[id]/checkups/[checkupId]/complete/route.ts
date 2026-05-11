import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { completeCheckupSchema } from "@/lib/validation";
import * as appointmentsService from "@/services/appointments.service";
import * as checkupsService from "@/services/checkups.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; checkupId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "doctor" && user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id, checkupId } = await params;
    const patientId = parseInt(id, 10);
    const pcId = parseInt(checkupId, 10);
    if (isNaN(patientId) || isNaN(pcId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    if (user.role === "doctor") {
      const doctorId = await appointmentsService.getDoctorId(user.id);
      if (!doctorId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      const hasAccess = await appointmentsService.verifyDoctorPatientAccess(doctorId, patientId);
      if (!hasAccess) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const checkup = await checkupsService.findById(pcId);
    if (!checkup || checkup.patient_id !== patientId || !checkup.active) {
      return NextResponse.json({ error: "Control no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = completeCheckupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    if (new Date(parsed.data.completed_at) > new Date()) {
      return NextResponse.json({ error: "No se puede registrar una fecha futura" }, { status: 400 });
    }

    const result = await checkupsService.completeCheckup(
      pcId,
      parsed.data.completed_at,
      user.id,
      parsed.data.notes
    );

    if (result.conflict) {
      return NextResponse.json({ error: "Ya existe un registro cercano a esa fecha" }, { status: 409 });
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("POST /api/doctor/patient/[id]/checkups/[checkupId]/complete error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

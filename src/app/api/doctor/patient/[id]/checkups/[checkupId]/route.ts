import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { updatePatientCheckupSchema } from "@/lib/validation";
import * as appointmentsService from "@/services/appointments.service";
import * as checkupsService from "@/services/checkups.service";

export async function PATCH(
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
    if (!checkup || checkup.patient_id !== patientId) {
      return NextResponse.json({ error: "Control no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updatePatientCheckupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await checkupsService.updatePatientCheckup(pcId, parsed.data);
    if (!updated) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

    return NextResponse.json({ checkup: updated });
  } catch (error) {
    console.error("PATCH /api/doctor/patient/[id]/checkups/[checkupId] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

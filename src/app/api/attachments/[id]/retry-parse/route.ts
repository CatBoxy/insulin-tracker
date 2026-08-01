import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as appointmentsService from "@/services/appointments.service";
import * as attachmentsService from "@/services/attachments.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const attachmentId = parseInt(id, 10);
    if (isNaN(attachmentId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const attachment = await attachmentsService.findAttachment(attachmentId);
    if (!attachment) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

    // Verify access
    const patientId = await resolvePatientId(user.id);
    if (patientId !== attachment.patient_id && user.role !== "admin") {
      if (user.role === "doctor") {
        const doctorId = await appointmentsService.getDoctorId(user.id);
        if (!doctorId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        const hasAccess = await appointmentsService.verifyDoctorPatientAccess(doctorId, attachment.patient_id);
        if (!hasAccess) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const result = await attachmentsService.retryParse(attachmentId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/attachments/[id]/retry-parse error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

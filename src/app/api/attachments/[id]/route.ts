import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as appointmentsService from "@/services/appointments.service";
import * as attachmentsService from "@/services/attachments.service";

export async function GET(
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

    // Verify access: owner patient or their doctor
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

    const completionAttachments = await attachmentsService.listByCompletion(attachment.checkup_completion_id);
    const target = completionAttachments.find((a: { id: number }) => a.id === attachmentId);
    return NextResponse.json({ attachment: target });
  } catch (error) {
    console.error("GET /api/attachments/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Only uploader, patient owner, or their doctor can delete
    const patientId = await resolvePatientId(user.id);
    const isOwnerPatient = patientId === attachment.patient_id;
    const isUploader = attachment.uploaded_by_user_id === user.id;

    if (!isOwnerPatient && !isUploader && user.role !== "admin") {
      if (user.role === "doctor") {
        const doctorId = await appointmentsService.getDoctorId(user.id);
        if (!doctorId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        const hasAccess = await appointmentsService.verifyDoctorPatientAccess(doctorId, attachment.patient_id);
        if (!hasAccess) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const result = await attachmentsService.deleteAttachment(attachmentId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/attachments/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

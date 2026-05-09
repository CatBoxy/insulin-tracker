import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as doctorService from "@/services/doctor.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "doctor" && user.role !== "admin")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id: patientId } = await params;
    const pid = parseInt(patientId, 10);

    const doctorId = await doctorService.getDoctorId(user.id);
    if (!doctorId) {
      return NextResponse.json({ error: "No es doctor" }, { status: 403 });
    }

    const hasAccess = await doctorService.verifyAccess(doctorId, pid);
    if (!hasAccess) {
      return NextResponse.json({ error: "Sin acceso a este paciente" }, { status: 403 });
    }

    const result = await doctorService.getPatientDetail(pid, doctorId);
    if (!result) {
      return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/doctor/patients/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

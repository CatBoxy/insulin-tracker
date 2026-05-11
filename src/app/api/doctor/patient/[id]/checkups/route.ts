import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as appointmentsService from "@/services/appointments.service";
import * as checkupsService from "@/services/checkups.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "doctor" && user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const patientId = parseInt(id, 10);
    if (isNaN(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    if (user.role === "doctor") {
      const doctorId = await appointmentsService.getDoctorId(user.id);
      if (!doctorId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      const hasAccess = await appointmentsService.verifyDoctorPatientAccess(doctorId, patientId);
      if (!hasAccess) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const checkups = await checkupsService.listForDoctorPatient(patientId);
    return NextResponse.json({ checkups });
  } catch (error) {
    console.error("GET /api/doctor/patient/[id]/checkups error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

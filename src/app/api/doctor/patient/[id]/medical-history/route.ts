import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as doctorService from "@/services/doctor.service";
import * as medicalHistory from "@/services/medical-history.service";

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

    const doctorId = await doctorService.getDoctorId(user.id);
    if (!doctorId) return NextResponse.json({ error: "Doctor no encontrado" }, { status: 404 });

    const { id } = await params;
    const patientId = parseInt(id, 10);
    if (isNaN(patientId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const hasAccess = await doctorService.verifyAccess(doctorId, patientId);
    if (!hasAccess) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

    const data = await medicalHistory.getFullHistory(patientId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/doctor/patient/[id]/medical-history error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

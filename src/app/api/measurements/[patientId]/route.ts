import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { verifyAccess } from "@/services/doctor.service";
import { getDoctorId } from "@/services/appointments.service";
import * as measurementsService from "@/services/measurements.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { patientId } = await params;
    const pid = parseInt(patientId, 10);

    if (isNaN(pid)) {
      return NextResponse.json({ error: "ID de paciente inválido" }, { status: 400 });
    }

    if (user.role === "patient") {
      const myPatientId = await resolvePatientId(user.id);
      if (myPatientId !== pid) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    } else if (user.role === "doctor") {
      const doctorId = await getDoctorId(user.id);
      if (!doctorId || !(await verifyAccess(doctorId, pid))) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const type = url.searchParams.get("type") || undefined;

    const result = await measurementsService.listPaginated(pid, { page, limit, type });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("GET /api/measurements/[patientId] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

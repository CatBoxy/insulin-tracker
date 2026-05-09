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
    const type = url.searchParams.get("type") || "glucemia";
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;

    if (!["glucemia", "blood_pressure", "weight"].includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const result = await measurementsService.getChartData(pid, type, from, to);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("GET /api/measurements/[patientId]/chart error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

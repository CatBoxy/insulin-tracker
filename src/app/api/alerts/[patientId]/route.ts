import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { verifyAccess, getDoctorId } from "@/services/doctor.service";
import * as alertsService from "@/services/alerts.service";

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

    const alerts = await alertsService.listByPatient(pid);
    return NextResponse.json({ alerts });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Get alerts error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

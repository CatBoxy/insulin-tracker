import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as checkupsService from "@/services/checkups.service";
import * as checkupRequests from "@/services/checkup-requests.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const result = await checkupsService.listForPatient(patientId);

    // Include which checkups have pending order requests
    const checkupIds = result.checkups.map(c => c.id);
    const pendingRequestIds = await checkupRequests.listPendingByPatientCheckupIds(checkupIds);

    return NextResponse.json({
      ...result,
      pending_request_ids: pendingRequestIds,
    });
  } catch (error) {
    console.error("GET /api/checkups error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as checkupsService from "@/services/checkups.service";
import * as checkupRequests from "@/services/checkup-requests.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const { id } = await params;
    const checkupId = parseInt(id, 10);
    if (isNaN(checkupId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const checkup = await checkupsService.findById(checkupId);
    if (!checkup || checkup.patient_id !== patientId || !checkup.active) {
      return NextResponse.json({ error: "Control no encontrado" }, { status: 404 });
    }

    const result = await checkupRequests.createRequest(checkupId, patientId);

    if ("error" in result) {
      if (result.error === "no_doctor") {
        return NextResponse.json(
          { error: "No tenés un médico asignado. Pedile a tu doctor que te vincule." },
          { status: 400 }
        );
      }
      if (result.error === "already_requested") {
        return NextResponse.json(
          { error: "Ya solicitaste esta orden. Tu médico fue notificado." },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("POST /api/checkups/[id]/request error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as checkupsService from "@/services/checkups.service";

export async function GET(
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
    if (!checkup || checkup.patient_id !== patientId) {
      return NextResponse.json({ error: "Control no encontrado" }, { status: 404 });
    }

    const completions = await checkupsService.listCompletions(checkupId);
    return NextResponse.json({ completions });
  } catch (error) {
    console.error("GET /api/checkups/[id]/history error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

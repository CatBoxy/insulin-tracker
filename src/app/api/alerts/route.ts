import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as alertsService from "@/services/alerts.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ alerts: [] });

    const alerts = await alertsService.listUnread(patientId);
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("GET /api/alerts error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "No hay registro de paciente" }, { status: 400 });

    const { alertIds } = await request.json();
    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json({ error: "alertIds requerido" }, { status: 400 });
    }

    await alertsService.dismissBatch(alertIds, patientId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/alerts error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

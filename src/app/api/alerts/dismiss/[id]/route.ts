import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as alertsService from "@/services/alerts.service";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const alertId = parseInt(id, 10);
    if (isNaN(alertId)) {
      return NextResponse.json({ error: "ID de alerta inválido" }, { status: 400 });
    }

    const alert = await alertsService.findById(alertId);
    if (!alert) {
      return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
    }

    if (user.role === "patient") {
      const myPatientId = await resolvePatientId(user.id);
      if (alert.patient_id !== myPatientId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    await alertsService.dismissOne(alertId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

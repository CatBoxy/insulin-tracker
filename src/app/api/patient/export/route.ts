import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { exportPatientData } from "@/services/data-rights.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "patient") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const data = await exportPatientData(patientId);

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/patient/export error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

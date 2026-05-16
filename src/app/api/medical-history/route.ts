import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as medicalHistory from "@/services/medical-history.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const data = await medicalHistory.getFullHistory(patientId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/medical-history error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const body = await request.json();

    if (!body.familyHistory || !body.personalHistory || !body.medications) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    await medicalHistory.saveHistory(patientId, {
      familyHistory: body.familyHistory,
      personalHistory: body.personalHistory,
      medications: body.medications,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/medical-history error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

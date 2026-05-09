import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as medicationsService from "@/services/medications.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ medications: [] });

    const medications = await medicationsService.listForPatient(patientId);
    return NextResponse.json({ medications });
  } catch (error) {
    console.error("GET /api/medications error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import * as questionnairesService from "@/services/questionnaires.service";
import * as studyService from "@/services/study.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const participant = await studyService.getByPatientId(patientId);
    if (!participant) return NextResponse.json({ error: "Participante no encontrado" }, { status: 404 });

    const questionnaires = await questionnairesService.listActive();
    const responses = await questionnairesService.getResponses(participant.id);

    return NextResponse.json({ questionnaires, responses });
  } catch (error) {
    console.error("GET /api/questionnaires error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

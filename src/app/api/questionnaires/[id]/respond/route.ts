import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { submitQuestionnaireSchema } from "@/lib/validation";
import * as questionnairesService from "@/services/questionnaires.service";
import * as studyService from "@/services/study.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const participant = await studyService.getByPatientId(patientId);
    if (!participant) return NextResponse.json({ error: "Participante no encontrado" }, { status: 404 });

    const { id } = await params;
    const questionnaireId = parseInt(id, 10);
    if (isNaN(questionnaireId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = await request.json();
    const parsed = submitQuestionnaireSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { answers, studyVisitId } = parsed.data;

    // Verify questionnaire exists and is active
    const questionnaire = await questionnairesService.getWithItems(questionnaireId);
    if (!questionnaire || !questionnaire.active) {
      return NextResponse.json({ error: "Cuestionario no disponible" }, { status: 404 });
    }

    // Create response and submit answers
    const response = await questionnairesService.createResponse(
      participant.id,
      questionnaireId,
      studyVisitId
    );
    await questionnairesService.submitAnswers(response.id, answers);

    return NextResponse.json({ response: { ...response, completed_at: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/questionnaires/[id]/respond error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

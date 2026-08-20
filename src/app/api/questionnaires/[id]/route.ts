import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as questionnairesService from "@/services/questionnaires.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const questionnaireId = parseInt(id, 10);
    if (isNaN(questionnaireId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const questionnaire = await questionnairesService.getWithItems(questionnaireId);
    if (!questionnaire) return NextResponse.json({ error: "Cuestionario no encontrado" }, { status: 404 });

    return NextResponse.json({ questionnaire });
  } catch (error) {
    console.error("GET /api/questionnaires/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { createQuestionnaireSchema } from "@/lib/validation";
import * as questionnairesService from "@/services/questionnaires.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const questionnaires = await questionnairesService.listAll();
    return NextResponse.json({ questionnaires });
  } catch (error) {
    console.error("GET /api/admin/questionnaires error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const parsed = createQuestionnaireSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const questionnaire = await questionnairesService.createQuestionnaire(parsed.data);
    return NextResponse.json({ questionnaire }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message?.includes("duplicate key")) {
      return NextResponse.json({ error: "Ya existe un cuestionario con ese código" }, { status: 409 });
    }
    console.error("POST /api/admin/questionnaires error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

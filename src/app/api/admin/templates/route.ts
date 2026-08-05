import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { createTemplateSchema } from "@/lib/validation";
import * as templatesService from "@/services/templates.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const templates = await templatesService.list();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("GET /api/admin/templates error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const template = await templatesService.create(
      parsed.data.key,
      parsed.data.channel,
      parsed.data.category,
      parsed.data.body,
      parsed.data.variables
    );
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/templates error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

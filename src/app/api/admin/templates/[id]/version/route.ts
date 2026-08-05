import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { newVersionSchema } from "@/lib/validation";
import * as templatesService from "@/services/templates.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { id } = await params;
    const existing = await templatesService.getById(Number(id));
    if (!existing) return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });

    const body = await request.json();
    const parsed = newVersionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const template = await templatesService.createNewVersion(
      existing.key,
      existing.channel,
      parsed.data.body,
      parsed.data.variables
    );
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/templates/[id]/version error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

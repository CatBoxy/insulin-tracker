import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as templatesService from "@/services/templates.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { id } = await params;
    const template = await templatesService.getById(Number(id));
    if (!template) return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });

    // Also fetch all versions of this template
    const versions = await templatesService.getByKey(template.key);

    return NextResponse.json({ template, versions });
  } catch (error) {
    console.error("GET /api/admin/templates/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { id } = await params;
    const templateId = Number(id);
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "approve": {
        const template = await templatesService.approve(templateId, user.id);
        return NextResponse.json({ template });
      }
      case "activate": {
        try {
          const template = await templatesService.activate(templateId);
          return NextResponse.json({ template });
        } catch (err) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : "Error" },
            { status: 400 }
          );
        }
      }
      case "deactivate": {
        const template = await templatesService.deactivate(templateId);
        return NextResponse.json({ template });
      }
      case "update_wa_status": {
        const { status, rejectionReason } = body;
        if (!status) return NextResponse.json({ error: "status requerido" }, { status: 400 });
        const template = await templatesService.updateWaStatus(templateId, status, rejectionReason);
        return NextResponse.json({ template });
      }
      default:
        return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }
  } catch (error) {
    console.error("PATCH /api/admin/templates/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

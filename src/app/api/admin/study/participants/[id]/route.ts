import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { changeArmSchema, withdrawParticipantSchema } from "@/lib/validation";
import * as studyService from "@/services/study.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { id } = await params;
    const participantId = parseInt(id, 10);
    if (isNaN(participantId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action;

    if (action === "change_arm") {
      const parsed = changeArmSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
      }
      await studyService.changeArm(participantId, parsed.data.newArm, user.id, parsed.data.reason);
      return NextResponse.json({ success: true, message: "Brazo actualizado" });
    }

    if (action === "withdraw") {
      const parsed = withdrawParticipantSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
      }
      await studyService.withdraw(participantId, parsed.data.reason, user.id);
      return NextResponse.json({ success: true, message: "Participante retirado" });
    }

    return NextResponse.json({ error: "Acción inválida. Use 'change_arm' o 'withdraw'." }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "Participant not found" || msg === "Participant not found or already withdrawn") {
      return NextResponse.json({ error: "Participante no encontrado" }, { status: 404 });
    }
    console.error("PATCH /api/admin/study/participants/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { id } = await params;
    const participantId = parseInt(id, 10);
    if (isNaN(participantId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const auditHistory = await studyService.getAuditHistory(participantId);
    return NextResponse.json({ auditHistory });
  } catch (error) {
    console.error("GET /api/admin/study/participants/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

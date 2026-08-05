import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as studyService from "@/services/study.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const participantId = parseInt(id, 10);
    if (isNaN(participantId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const visits = await studyService.listVisits(participantId);
    return NextResponse.json({ visits });
  } catch (error) {
    console.error("GET /api/admin/study/participants/[id]/visits error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const participantId = parseInt(id, 10);
    if (isNaN(participantId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { visitId, performedDate, notes } = body;

    if (!visitId || !performedDate) {
      return NextResponse.json(
        { error: "visitId y performedDate son requeridos" },
        { status: 400 }
      );
    }

    // Resolve doctor_id from admin user (admins may also be doctors)
    const pool = (await import("@/lib/db")).default;
    const { rows: doctorRows } = await pool.query(
      "SELECT id FROM doctors WHERE user_id = $1",
      [user.id]
    );
    const doctorId = doctorRows[0]?.id ?? null;

    const visit = await studyService.recordVisit(
      visitId,
      performedDate,
      doctorId,
      notes
    );
    return NextResponse.json({ visit });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "Visit not found") {
      return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
    }
    console.error("PATCH /api/admin/study/participants/[id]/visits error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { erasePatientData } from "@/services/data-rights.service";
import pool from "@/lib/db";

export async function POST(
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
    if (body.confirm !== true) {
      return NextResponse.json(
        { error: "Debe enviar { confirm: true } para confirmar la eliminación irreversible de datos identificables" },
        { status: 400 }
      );
    }

    // Resolve patient_id from study_participants
    const { rows } = await pool.query(
      "SELECT patient_id FROM study_participants WHERE id = $1",
      [participantId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Participante no encontrado" }, { status: 404 });
    }

    const patientId = rows[0].patient_id;
    const result = await erasePatientData(patientId, user.id);

    return NextResponse.json({
      success: true,
      message: "Datos identificables eliminados. El código de participante y los datos clínicos fueron conservados.",
      ...result,
    });
  } catch (error) {
    console.error("POST /api/admin/study/participants/[id]/erase error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

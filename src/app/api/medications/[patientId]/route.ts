import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import * as medicationsService from "@/services/medications.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { patientId } = await params;
    const pid = parseInt(patientId, 10);

    if (isNaN(pid)) {
      return NextResponse.json({ error: "ID de paciente inválido" }, { status: 400 });
    }

    if (user.id !== pid && user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const medications = await medicationsService.listForPatientDetailed(pid);
    return NextResponse.json({ medications });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Get medications error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

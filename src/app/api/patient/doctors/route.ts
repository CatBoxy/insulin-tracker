import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as accountService from "@/services/account.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "patient") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const doctors = await accountService.getLinkedDoctors(user.id);
    return NextResponse.json({ doctors });
  } catch (error) {
    console.error("GET /api/patient/doctors error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "patient") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { assignment_id } = await request.json();
    if (!assignment_id) return NextResponse.json({ error: "assignment_id requerido" }, { status: 400 });

    const success = await accountService.unlinkDoctor(user.id, assignment_id);
    if (!success) return NextResponse.json({ error: "Vínculo no encontrado" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/patient/doctors error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as doctorService from "@/services/doctor.service";
import * as checkupRequests from "@/services/checkup-requests.service";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "doctor" && user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const doctorId = await doctorService.getDoctorId(user.id);
    if (!doctorId) return NextResponse.json({ error: "Doctor no encontrado" }, { status: 404 });

    const { id } = await params;
    const requestId = parseInt(id, 10);
    if (isNaN(requestId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const updated = await checkupRequests.markSeen(requestId, doctorId);
    if (!updated) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/doctor/checkup-requests/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

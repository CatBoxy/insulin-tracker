import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as doctorService from "@/services/doctor.service";
import * as checkupRequests from "@/services/checkup-requests.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "doctor" && user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const doctorId = await doctorService.getDoctorId(user.id);
    if (!doctorId) return NextResponse.json({ error: "Doctor no encontrado" }, { status: 404 });

    const requests = await checkupRequests.listForDoctor(doctorId);

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("GET /api/doctor/checkup-requests error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as doctorService from "@/services/doctor.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== "doctor" && user.role !== "admin")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const doctorId = await doctorService.getDoctorId(user.id);
    if (!doctorId) {
      return NextResponse.json({ patients: [] });
    }

    const patients = await doctorService.listPatients(doctorId);
    return NextResponse.json({ patients });
  } catch (error) {
    console.error("GET /api/doctor/patients error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

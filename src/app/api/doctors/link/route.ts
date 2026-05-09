import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { getDoctorByCode, linkPatientToDoctor } from "@/services/doctor-link.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "patient") return NextResponse.json({ error: "Solo pacientes pueden vincularse" }, { status: 403 });

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });

    const doctor = await getDoctorByCode(code);
    if (!doctor) return NextResponse.json({ error: "Código de doctor inválido" }, { status: 404 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "No hay registro de paciente" }, { status: 400 });

    const result = await linkPatientToDoctor(patientId, doctor.id);

    if (result === "already_linked") {
      return NextResponse.json({ message: "Ya estás vinculado con este doctor" }, { status: 409 });
    }

    const doctorName = [doctor.first_name, doctor.last_name].filter(Boolean).join(" ") || doctor.email.split("@")[0];
    return NextResponse.json({
      message: `Vinculado con Dr. ${doctorName}`,
      doctor: { name: doctorName },
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/doctors/link error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

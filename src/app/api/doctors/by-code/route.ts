import { NextRequest, NextResponse } from "next/server";
import { getDoctorByCode } from "@/services/doctor-link.service";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 });

    const doctor = await getDoctorByCode(code);
    if (!doctor) return NextResponse.json({ error: "Código inválido" }, { status: 404 });

    return NextResponse.json({
      doctor: {
        name: [doctor.first_name, doctor.last_name].filter(Boolean).join(" ") || doctor.email.split("@")[0],
        code: doctor.code,
      },
    });
  } catch (error) {
    console.error("GET /api/doctors/by-code error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

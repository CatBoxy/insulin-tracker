import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";
import * as authService from "@/services/auth.service";
import { getDoctorByCode, linkPatientToDoctor } from "@/services/doctor-link.service";
import { resolvePatientId } from "@/lib/patient-resolve";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!rateLimit(`register:${ip}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Demasiados intentos. Intente más tarde." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email, password, first_name, last_name, date_of_birth, gender, phone, doctorCode, role } = parsed.data;

    if (await authService.emailExists(email)) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
    }

    const user = await authService.createUser({
      email, password, first_name, last_name,
      date_of_birth, gender, phone,
      role: role || "patient",
    });
    const token = await authService.createToken(user);

    // Auto-link to doctor if code provided (only for patients)
    let linkedDoctor: string | null = null;
    if (doctorCode && user.role === "patient") {
      const doctor = await getDoctorByCode(doctorCode);
      if (doctor) {
        const patientId = await resolvePatientId(user.id);
        if (patientId) {
          await linkPatientToDoctor(patientId, doctor.id);
          linkedDoctor = [doctor.first_name, doctor.last_name].filter(Boolean).join(" ") || doctor.email.split("@")[0];
        }
      }
    }

    const response = NextResponse.json({ user, linkedDoctor }, { status: 201 });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

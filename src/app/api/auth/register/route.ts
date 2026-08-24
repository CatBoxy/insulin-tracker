import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation";
import * as authService from "@/services/auth.service";
import { getDoctorByCode, linkPatientToDoctor } from "@/services/doctor-link.service";
import { resolvePatientId } from "@/lib/patient-resolve";
import { sendEmail, verificationEmailHtml } from "@/services/email.service";
import { createVerificationToken } from "@/services/verification.service";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email, password, first_name, last_name, date_of_birth, gender, phone, doctorCode, role } = parsed.data;
    const inviteCode = body.invite_code?.trim()?.toUpperCase();

    if (!inviteCode) {
      return NextResponse.json({ error: "Código de invitación requerido" }, { status: 400 });
    }

    const { rows: codeRows } = await pool.query(
      "SELECT id, used_at FROM invite_codes WHERE code = $1",
      [inviteCode]
    );
    if (codeRows.length === 0) {
      return NextResponse.json({ error: "Código de invitación inválido" }, { status: 400 });
    }
    if (codeRows[0].used_at) {
      return NextResponse.json({ error: "Este código de invitación ya fue utilizado" }, { status: 400 });
    }
    const inviteCodeId = codeRows[0].id;

    if (await authService.emailExists(email)) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
    }

    const user = await authService.createUser({
      email, password, first_name, last_name,
      date_of_birth, gender, phone,
      role: role || "patient",
    });

    await pool.query(
      "UPDATE invite_codes SET used_by = $1, used_at = NOW() WHERE id = $2",
      [user.id, inviteCodeId]
    );

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

    // Send verification email (fire and forget)
    const verificationRawToken = await createVerificationToken(user.id);
    const baseUrl = process.env.APP_URL || "https://glyco.fit";
    const verifyUrl = `${baseUrl}/verify-email?token=${verificationRawToken}`;

    sendEmail({
      to: email,
      subject: "Confirmá tu email — Glycofit",
      html: verificationEmailHtml(first_name, verifyUrl),
    }).catch(err => console.error("Verification email failed:", err));

    return NextResponse.json(
      { verificationPending: true, email, linkedDoctor },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

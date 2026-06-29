import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation";
import { findUserByEmail } from "@/services/auth.service";
import { createPasswordResetToken } from "@/services/verification.service";
import { sendEmail, passwordResetEmailHtml } from "@/services/email.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const user = await findUserByEmail(parsed.data.email);
    if (user) {
      const rawToken = await createPasswordResetToken(user.id);
      const baseUrl = process.env.APP_URL || "https://glyco.fit";
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      sendEmail({
        to: user.email,
        subject: "Restablecer contraseña — Glycofit",
        html: passwordResetEmailHtml(user.first_name || user.email.split("@")[0], resetUrl),
      }).catch(err => console.error("Password reset email failed:", err));
    }

    return NextResponse.json({ message: "Si el email existe, recibirás un enlace para restablecer tu contraseña." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

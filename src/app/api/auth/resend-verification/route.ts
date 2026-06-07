import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { resendVerificationSchema } from "@/lib/validation";
import { findUserByEmail } from "@/services/auth.service";
import { createVerificationToken } from "@/services/verification.service";
import { sendEmail, verificationEmailHtml } from "@/services/email.service";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!rateLimit(`resend-verify:${ip}`, 3, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Demasiados intentos. Intente más tarde." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = resendVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const user = await findUserByEmail(parsed.data.email);
    if (user && !user.email_verified) {
      const rawToken = await createVerificationToken(user.id);
      const baseUrl = process.env.APP_URL || "https://glyco.fit";
      const verifyUrl = `${baseUrl}/verify-email?token=${rawToken}`;

      sendEmail({
        to: user.email,
        subject: "Confirmá tu email — Glycofit",
        html: verificationEmailHtml(user.first_name || user.email.split("@")[0], verifyUrl),
      }).catch(err => console.error("Resend verification email failed:", err));
    }

    return NextResponse.json({ message: "Si el email existe y no está verificado, recibirás un enlace de confirmación." });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

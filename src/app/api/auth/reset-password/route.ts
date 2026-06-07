import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { validateAndConsumeResetToken, resetPassword } from "@/services/verification.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const result = await validateAndConsumeResetToken(parsed.data.token);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const newHash = await hashPassword(parsed.data.password);
    await resetPassword(result.userId!, newHash);

    return NextResponse.json({ message: "Contraseña actualizada exitosamente" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

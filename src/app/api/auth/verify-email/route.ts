import { NextRequest, NextResponse } from "next/server";
import { verifyEmailSchema } from "@/lib/validation";
import { verifyEmail } from "@/services/verification.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const result = await verifyEmail(parsed.data.token);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ message: "Email verificado exitosamente" });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

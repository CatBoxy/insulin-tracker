import { NextRequest, NextResponse } from "next/server";
import { verifyEmailSchema } from "@/lib/validation";
import { verifyEmail } from "@/services/verification.service";
import pool from "@/lib/db";
import { createToken } from "@/services/auth.service";

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

    // Fetch user and issue session token
    const { rows } = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [result.userId]
    );
    const user = rows[0];
    const token = await createToken(user);

    const response = NextResponse.json({ message: "Email verificado exitosamente", user, token });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

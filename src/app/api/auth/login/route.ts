import { NextRequest, NextResponse } from "next/server";
import { comparePassword, signToken } from "@/lib/auth";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!rateLimit(`login:${ip}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Demasiados intentos. Intente más tarde." }, { status: 429 });
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const { rows } = await pool.query("SELECT id, email, password_hash, role FROM users WHERE email = $1", [email.toLowerCase()]);
    if (rows.length === 0) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    const user = rows[0];
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    const token = await signToken({ sub: user.id, email: user.email, role: user.role });

    const response = NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

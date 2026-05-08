import { NextRequest, NextResponse } from "next/server";
import { hashPassword, signToken } from "@/lib/auth";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

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
    const { email, password } = parsed.data;

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
    }

    const password_hash = await hashPassword(password);

    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role",
      [email.toLowerCase(), password_hash, "patient", email.split("@")[0], ""]
    );

    const user = rows[0];

    // Auto-create patient record so they can log measurements immediately
    await pool.query("INSERT INTO patients (user_id) VALUES ($1)", [user.id]);

    // Auto-login: sign JWT and set cookie
    const token = await signToken({ sub: user.id, email: user.email, role: user.role });

    const response = NextResponse.json({ user }, { status: 201 });
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

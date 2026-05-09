import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";
import * as authService from "@/services/auth.service";

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

    if (await authService.emailExists(email)) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
    }

    const user = await authService.createPatientUser(email, password);
    const token = await authService.createToken(user);

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

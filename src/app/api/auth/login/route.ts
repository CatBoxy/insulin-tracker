import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import * as authService from "@/services/auth.service";

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

    const user = await authService.verifyCredentials(parsed.data.email, parsed.data.password);
    if (!user) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    const token = await authService.createToken(user);

    const response = NextResponse.json({ user });
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

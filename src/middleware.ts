import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(s);
}

function buildRedirectUrl(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (forwardedHost) {
    const [hostname, port] = forwardedHost.split(":");
    url.hostname = hostname;
    url.port = port || "";
  }
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) url.protocol = proto + ":";
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths
  if (pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/register") || pathname.startsWith("/api/doctors/by-code") || pathname.startsWith("/_next") || pathname.startsWith("/sw.js") || pathname.startsWith("/manifest") || pathname.startsWith("/favicon") || pathname.startsWith("/icon")) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : request.cookies.get("token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    return NextResponse.redirect(buildRedirectUrl(request, "/login"));
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Redirect users to their role-specific dashboard
    if (pathname === "/dashboard" || pathname === "/") {
      if (payload.role === "doctor") {
        return NextResponse.redirect(buildRedirectUrl(request, "/doctor"));
      }
      if (payload.role === "admin") {
        return NextResponse.redirect(buildRedirectUrl(request, "/admin"));
      }
    }

    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
      if (payload.role !== "admin") {
        if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        return NextResponse.redirect(buildRedirectUrl(request, payload.role === "doctor" ? "/doctor" : "/dashboard"));
      }
    }

    if ((pathname.startsWith("/doctor") || pathname.startsWith("/api/doctor")) && !pathname.startsWith("/api/doctors/link") && !pathname.startsWith("/api/doctors/by-code")) {
      if (payload.role !== "doctor" && payload.role !== "admin") {
        if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        return NextResponse.redirect(buildRedirectUrl(request, "/dashboard"));
      }
    }

    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    const response = NextResponse.redirect(buildRedirectUrl(request, "/login"));
    response.cookies.set("token", "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

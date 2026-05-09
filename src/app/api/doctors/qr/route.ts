import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { getDoctorCode } from "@/services/doctor-link.service";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (user.role !== "doctor") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const code = await getDoctorCode(user.id);
    if (!code) return NextResponse.json({ error: "No se encontró código de doctor" }, { status: 404 });

    const format = request.nextUrl.searchParams.get("format");
    const origin = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3008";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const linkUrl = `${protocol}://${origin}/register?doctor=${code}`;

    if (format === "png") {
      const buffer = await QRCode.toBuffer(linkUrl, { width: 400, margin: 2 });
      return new NextResponse(new Uint8Array(buffer), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
      });
    }

    const dataUrl = await QRCode.toDataURL(linkUrl, { width: 400, margin: 2 });
    return NextResponse.json({ code, url: linkUrl, qr: dataUrl });
  } catch (error) {
    console.error("GET /api/doctors/qr error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

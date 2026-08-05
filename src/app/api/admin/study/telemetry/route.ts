import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { getStudyOverview } from "@/services/telemetry.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin")
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const overview = await getStudyOverview();
    return NextResponse.json(overview);
  } catch (error) {
    console.error("GET /api/admin/study/telemetry error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

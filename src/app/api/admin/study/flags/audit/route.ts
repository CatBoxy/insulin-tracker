import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as featuresService from "@/services/features.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const audit = await featuresService.getAudit();
    return NextResponse.json({ audit });
  } catch (error) {
    console.error("GET /api/admin/study/flags/audit error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

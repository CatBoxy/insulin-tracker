import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as studyService from "@/services/study.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const participants = await studyService.listAll();
    return NextResponse.json({ participants });
  } catch (error) {
    console.error("GET /api/admin/study/participants error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

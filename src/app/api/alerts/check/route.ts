import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import * as alertsService from "@/services/alerts.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "doctor" && user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const created = await alertsService.checkInactivityAndCritical();
    return NextResponse.json({ ok: true, created });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Check alerts error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { checkAndCreateRefillAlerts } from "@/services/alerts.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const result = await checkAndCreateRefillAlerts();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Check refills error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

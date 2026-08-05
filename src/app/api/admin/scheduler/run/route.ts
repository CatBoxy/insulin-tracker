import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { runScheduler } from "@/services/messaging/scheduler";

export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const result = await runScheduler();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/admin/scheduler/run error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

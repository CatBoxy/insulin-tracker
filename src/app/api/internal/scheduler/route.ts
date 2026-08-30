import { NextRequest, NextResponse } from "next/server";
import { runScheduler } from "@/services/messaging/scheduler";
import { checkInactivityAndCritical } from "@/services/alerts.service";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-internal-key");
  if (authHeader !== process.env.INTERNAL_SCHEDULER_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [schedulerResult, alertsCreated] = await Promise.all([
      runScheduler(),
      checkInactivityAndCritical(),
    ]);
    return NextResponse.json({ scheduler: schedulerResult, alerts: alertsCreated });
  } catch (error) {
    console.error("Internal scheduler error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

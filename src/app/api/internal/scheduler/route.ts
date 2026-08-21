import { NextRequest, NextResponse } from "next/server";
import { runScheduler } from "@/services/messaging/scheduler";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-internal-key");
  if (authHeader !== process.env.INTERNAL_SCHEDULER_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduler();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Internal scheduler error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

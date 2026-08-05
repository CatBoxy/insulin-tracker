import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import {
  getParticipantMessageStats,
  getWeeklyEngagement,
} from "@/services/telemetry.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin")
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { participantId: pidStr } = await params;
    const participantId = Number(pidStr);
    if (!participantId || isNaN(participantId))
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const url = new URL(req.url);
    const from = url.searchParams.get("from") || undefined;
    const to = url.searchParams.get("to") || undefined;

    const stats = await getParticipantMessageStats(participantId, from, to);

    let weeklyEngagement = null;
    if (from && to) {
      weeklyEngagement = await getWeeklyEngagement(participantId, from, to);
    }

    return NextResponse.json({ stats, weeklyEngagement });
  } catch (error) {
    console.error("GET /api/admin/study/telemetry/[participantId] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

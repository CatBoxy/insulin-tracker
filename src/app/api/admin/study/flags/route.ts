import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { setFlagSchema } from "@/lib/validation";
import * as featuresService from "@/services/features.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const flags = await featuresService.listFlags();
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("GET /api/admin/study/flags error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const parsed = setFlagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { flagKey, arm, enabled, reason } = parsed.data;
    await featuresService.setFlag(flagKey, arm, enabled, user.id, reason);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/study/flags error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

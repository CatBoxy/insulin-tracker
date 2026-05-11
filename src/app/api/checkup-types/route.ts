import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as appointmentsService from "@/services/appointments.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const types = await appointmentsService.listCheckupTypes();
    return NextResponse.json({ types });
  } catch (error) {
    console.error("GET /api/checkup-types error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

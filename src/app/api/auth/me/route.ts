import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { recordInteraction } from "@/services/sessions.service";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Track interaction for patients (fire-and-forget)
  if (user.role === "patient") {
    const patientId = await resolvePatientId(user.id);
    if (patientId) {
      const channel = request.headers.get("authorization")?.startsWith("Bearer ")
        ? "mobile"
        : "web";
      recordInteraction(patientId, channel as "web" | "mobile").catch(() => {
        // Silently ignore tracking errors — don't break auth
      });
    }
  }

  return NextResponse.json({ user });
}

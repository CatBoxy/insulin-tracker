import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { checkupOnboardingSchema } from "@/lib/validation";
import * as checkupsService from "@/services/checkups.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const body = await request.json();
    const parsed = checkupOnboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Verify all patient_checkup_ids belong to this patient
    for (const entry of parsed.data.entries) {
      const checkup = await checkupsService.findById(entry.patient_checkup_id);
      if (!checkup || checkup.patient_id !== patientId) {
        return NextResponse.json({ error: "Control no encontrado" }, { status: 404 });
      }
      // Reject future dates
      if (entry.last_completed_at && new Date(entry.last_completed_at) > new Date()) {
        return NextResponse.json({ error: "No se puede registrar una fecha futura" }, { status: 400 });
      }
    }

    await checkupsService.submitOnboarding(parsed.data.entries, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/checkups/onboarding error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

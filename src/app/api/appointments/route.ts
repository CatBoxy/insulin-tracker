import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { createAppointmentSchema } from "@/lib/validation";
import * as appointmentsService from "@/services/appointments.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const upcoming = request.nextUrl.searchParams.get("upcoming") === "true";

    if (user.role === "doctor" || user.role === "admin") {
      const doctorId = await appointmentsService.getDoctorId(user.id);
      if (!doctorId) return NextResponse.json({ appointments: [] });

      const appointments = await appointmentsService.listForDoctor(doctorId, upcoming);
      return NextResponse.json({ appointments });
    }

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ appointments: [] });

    const appointments = await appointmentsService.listForPatient(patientId, upcoming);
    return NextResponse.json({ appointments });
  } catch (error) {
    console.error("GET /api/appointments error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    if (user.role !== "doctor" && user.role !== "admin") {
      return NextResponse.json({ error: "Solo los doctores pueden crear citas" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const doctorId = await appointmentsService.getDoctorId(user.id);
    if (!doctorId) {
      return NextResponse.json({ error: "No es doctor" }, { status: 403 });
    }

    const hasAccess = await appointmentsService.verifyDoctorPatientAccess(doctorId, parsed.data.patient_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Sin acceso a este paciente" }, { status: 403 });
    }

    const appointment = await appointmentsService.create({
      patientId: parsed.data.patient_id,
      doctorId,
      scheduledAt: parsed.data.scheduled_at,
      durationMinutes: parsed.data.duration_minutes,
      location: parsed.data.location,
      type: parsed.data.type,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
      checkupTypeId: parsed.data.checkup_type_id,
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/appointments error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

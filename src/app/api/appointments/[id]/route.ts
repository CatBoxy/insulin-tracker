import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { updateAppointmentSchema } from "@/lib/validation";
import * as appointmentsService from "@/services/appointments.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const appointmentId = parseInt(id, 10);
    if (isNaN(appointmentId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = await request.json();

    const appt = await appointmentsService.findById(appointmentId);
    if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

    if (user.role === "patient") {
      const patientId = await resolvePatientId(user.id);
      if (appt.patient_id !== patientId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      if (body.status !== "confirmed") {
        return NextResponse.json({ error: "Solo podés confirmar la cita" }, { status: 400 });
      }
      await appointmentsService.confirmByPatient(appointmentId);
      return NextResponse.json({ ok: true });
    }

    const doctorId = await appointmentsService.getDoctorId(user.id);
    if (!doctorId && user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (doctorId && appt.doctor_id !== doctorId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const parsed = updateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await appointmentsService.update(appointmentId, parsed.data);
    if (!updated) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

    // Auto-complete linked checkup when appointment is marked completed
    if (parsed.data.status === "completed") {
      await appointmentsService.autoCompleteCheckup(appointmentId, user.id).catch(err =>
        console.error("Auto-complete checkup error:", err)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/appointments/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const appointmentId = parseInt(id, 10);
    if (isNaN(appointmentId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const appt = await appointmentsService.findById(appointmentId);
    if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

    if (user.role === "doctor") {
      const doctorId = await appointmentsService.getDoctorId(user.id);
      if (!doctorId || appt.doctor_id !== doctorId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    } else if (user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await appointmentsService.cancel(appointmentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/appointments/[id] error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

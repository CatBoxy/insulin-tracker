import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { measurementSchema } from "@/lib/validation";
import * as measurementsService from "@/services/measurements.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    let patientId: number | null;
    if (user.role === "admin") {
      const qp = request.nextUrl.searchParams.get("patient_id");
      patientId = qp ? Number(qp) : await resolvePatientId(user.id);
    } else {
      patientId = await resolvePatientId(user.id);
    }

    if (!patientId) return NextResponse.json({ measurements: [] });

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Number(limitParam), 1000) : 50;

    const measurements = await measurementsService.listByPatient(patientId, limit);
    return NextResponse.json({ measurements });
  } catch (error) {
    console.error("GET /api/measurements error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "No hay registro de paciente" }, { status: 400 });

    const body = await request.json();
    const parsed = measurementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const result = await measurementsService.create({
      patientId,
      type: parsed.data.type,
      value: parsed.data.value,
      systolic: parsed.data.systolic,
      diastolic: parsed.data.diastolic,
      context: parsed.data.context,
      notes: parsed.data.notes,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/measurements error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

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

    const pageParam = request.nextUrl.searchParams.get("page");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const typeParam = request.nextUrl.searchParams.get("type") || undefined;

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 50), 200) : 50;

    const result = await measurementsService.listPaginated(patientId, { page, limit, type: typeParam });
    return NextResponse.json({
      measurements: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      totalPages: result.pagination.totalPages,
    });
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

    if ("windowViolation" in result && result.windowViolation) {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/measurements error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

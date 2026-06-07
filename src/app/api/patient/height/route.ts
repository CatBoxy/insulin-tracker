import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import pool from "@/lib/db";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const patientId = await resolvePatientId(user.id);
  if (!patientId) return NextResponse.json({ error: "No es paciente" }, { status: 403 });

  const { rows } = await pool.query(
    "SELECT height_cm FROM patients WHERE id = $1",
    [patientId]
  );

  return NextResponse.json({ height_cm: rows[0]?.height_cm || null });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const patientId = await resolvePatientId(user.id);
  if (!patientId) return NextResponse.json({ error: "No es paciente" }, { status: 403 });

  const body = await request.json();
  const heightCm = Number(body.height_cm);

  if (!heightCm || heightCm < 50 || heightCm > 250) {
    return NextResponse.json({ error: "Altura debe ser entre 50 y 250 cm" }, { status: 400 });
  }

  await pool.query(
    "UPDATE patients SET height_cm = $1 WHERE id = $2",
    [heightCm, patientId]
  );

  return NextResponse.json({ height_cm: heightCm });
}

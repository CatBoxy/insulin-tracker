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
    "SELECT id, adipose_pct, muscle_pct, recorded_at FROM body_composition WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 10",
    [patientId]
  );

  return NextResponse.json({ entries: rows });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const patientId = await resolvePatientId(user.id);
  if (!patientId) return NextResponse.json({ error: "No es paciente" }, { status: 403 });

  const body = await request.json();
  const adipose = Number(body.adipose_pct);
  const muscle = Number(body.muscle_pct);

  if (!adipose || adipose < 1 || adipose > 70) {
    return NextResponse.json({ error: "Tejido adiposo debe ser entre 1% y 70%" }, { status: 400 });
  }
  if (!muscle || muscle < 1 || muscle > 70) {
    return NextResponse.json({ error: "Tejido muscular debe ser entre 1% y 70%" }, { status: 400 });
  }

  const { rows } = await pool.query(
    "INSERT INTO body_composition (patient_id, adipose_pct, muscle_pct) VALUES ($1, $2, $3) RETURNING id, adipose_pct, muscle_pct, recorded_at",
    [patientId, adipose, muscle]
  );

  return NextResponse.json({ entry: rows[0] }, { status: 201 });
}

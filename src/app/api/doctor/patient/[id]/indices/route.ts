import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import pool from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || (user.role !== "doctor" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const patientId = Number(id);

  const { rows } = await pool.query(
    `SELECT id, calf_circumference_cm, dynamometer_force_mmlm, chair_test_seconds, insulin_resistance_index, abdominal_circumference_cm, recorded_at
     FROM doctor_indices WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 20`,
    [patientId]
  );

  return NextResponse.json({ entries: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || (user.role !== "doctor" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const patientId = Number(id);

  // Resolve doctor_id
  const { rows: doctorRows } = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1",
    [user.id]
  );
  if (doctorRows.length === 0) {
    return NextResponse.json({ error: "Doctor no encontrado" }, { status: 404 });
  }
  const doctorId = doctorRows[0].id;

  const body = await request.json();
  const { calf_circumference_cm, dynamometer_force_mmlm, chair_test_seconds, insulin_resistance_index, abdominal_circumference_cm } = body;

  // At least one value required
  if (!calf_circumference_cm && !dynamometer_force_mmlm && !chair_test_seconds && !insulin_resistance_index && !abdominal_circumference_cm) {
    return NextResponse.json({ error: "Al menos un índice requerido" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO doctor_indices (patient_id, doctor_id, calf_circumference_cm, dynamometer_force_mmlm, chair_test_seconds, insulin_resistance_index, abdominal_circumference_cm)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, calf_circumference_cm, dynamometer_force_mmlm, chair_test_seconds, insulin_resistance_index, abdominal_circumference_cm, recorded_at`,
    [patientId, doctorId, calf_circumference_cm || null, dynamometer_force_mmlm || null, chair_test_seconds || null, insulin_resistance_index || null, abdominal_circumference_cm || null]
  );

  return NextResponse.json({ entry: rows[0] }, { status: 201 });
}

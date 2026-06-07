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
  const { rows } = await pool.query(
    "SELECT id, value, recorded_at FROM measurements WHERE patient_id = $1 AND type = 'weight' ORDER BY recorded_at DESC LIMIT 10",
    [Number(id)]
  );

  return NextResponse.json({ entries: rows });
}

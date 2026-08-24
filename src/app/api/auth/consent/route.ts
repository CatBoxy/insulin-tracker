import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import pool from "@/lib/db";

export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { rows } = await pool.query(
      "SELECT id FROM patients WHERE user_id = $1",
      [user.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "No hay registro de paciente" }, { status: 400 });
    }

    await pool.query(
      "UPDATE patients SET consent_accepted_at = NOW() WHERE user_id = $1 AND consent_accepted_at IS NULL",
      [user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/consent error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

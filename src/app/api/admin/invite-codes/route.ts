import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import pool from "@/lib/db";
import crypto from "crypto";

function generateCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { rows } = await pool.query(
      `SELECT ic.id, ic.code, ic.notes, ic.used_at, ic.created_at,
              creator.email AS created_by_email,
              consumer.email AS used_by_email
       FROM invite_codes ic
       JOIN users creator ON creator.id = ic.created_by
       LEFT JOIN users consumer ON consumer.id = ic.used_by
       ORDER BY ic.created_at DESC`
    );

    return NextResponse.json({ codes: rows });
  } catch (error) {
    console.error("GET /api/admin/invite-codes error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const notes = body.notes?.trim() || null;

    let code = generateCode();
    for (let i = 0; i < 5; i++) {
      const { rows } = await pool.query("SELECT 1 FROM invite_codes WHERE code = $1", [code]);
      if (rows.length === 0) break;
      code = generateCode();
    }

    const { rows } = await pool.query(
      `INSERT INTO invite_codes (code, created_by, notes)
       VALUES ($1, $2, $3)
       RETURNING id, code, notes, created_at`,
      [code, user.id, notes]
    );

    return NextResponse.json({ code: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/invite-codes error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const id = body.id;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const { rows } = await pool.query(
      "SELECT used_at FROM invite_codes WHERE id = $1",
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
    if (rows[0].used_at) return NextResponse.json({ error: "No se puede revocar un código ya utilizado" }, { status: 400 });

    await pool.query("DELETE FROM invite_codes WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/invite-codes error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

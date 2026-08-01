import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const { rows } = await pool.query("SELECT 1 AS ok");
    if (!rows[0]?.ok) throw new Error("DB check failed");
    return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "error", ts: new Date().toISOString() },
      { status: 503 }
    );
  }
}

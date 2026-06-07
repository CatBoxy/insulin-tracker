import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { verifyToken } from "./auth";
import pool from "./db";

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  email_verified: boolean;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : (await cookies()).get("token")?.value;
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    const { rows } = await pool.query("SELECT id, email, role, email_verified FROM users WHERE id = $1", [payload.sub]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(_request: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return user;
}

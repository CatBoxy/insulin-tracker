import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as adminService from "@/services/admin.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const users = await adminService.listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { email, password, role } = await request.json();
    if (!email || !password || !role) return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
    if (!["patient", "doctor", "admin"].includes(role)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

    if (await adminService.emailExists(email)) {
      return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });
    }

    const newUser = await adminService.createUser(email, password, role);
    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

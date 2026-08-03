import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as adminService from "@/services/admin.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const patients = await adminService.listPatientsWithDob();
    return NextResponse.json({ patients });
  } catch (error) {
    console.error("GET /api/admin/study/patients error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

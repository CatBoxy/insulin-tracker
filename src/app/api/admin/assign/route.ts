import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import * as adminService from "@/services/admin.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { doctor_user_id, patient_id: rawPatientId } = await request.json();
    if (!doctor_user_id || !rawPatientId) {
      return NextResponse.json({ error: "doctor_user_id y patient_id requeridos" }, { status: 400 });
    }

    const result = await adminService.assignPatientToDoctor(doctor_user_id, rawPatientId);

    if (result === "reassigned") {
      return NextResponse.json({ message: "Reasignado" });
    }
    return NextResponse.json({ message: "Paciente asignado" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_NOT_DOCTOR") {
        return NextResponse.json({ error: "Usuario no es doctor" }, { status: 400 });
      }
      if (error.message === "ALREADY_ASSIGNED") {
        return NextResponse.json({ error: "Ya asignado" }, { status: 409 });
      }
    }
    console.error("POST /api/admin/assign error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const assignments = await adminService.listAssignments();
    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("GET /api/admin/assign error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await request.json();
    await adminService.removeAssignment(id);
    return NextResponse.json({ message: "Asignación removida" });
  } catch (error) {
    console.error("DELETE /api/admin/assign error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

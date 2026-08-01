import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { completeCheckupSchema } from "@/lib/validation";
import * as checkupsService from "@/services/checkups.service";
import * as attachmentsService from "@/services/attachments.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const patientId = await resolvePatientId(user.id);
    if (!patientId) return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });

    const { id } = await params;
    const checkupId = parseInt(id, 10);
    if (isNaN(checkupId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const checkup = await checkupsService.findById(checkupId);
    if (!checkup || checkup.patient_id !== patientId || !checkup.active) {
      return NextResponse.json({ error: "Control no encontrado" }, { status: 404 });
    }

    // Parse FormData (supports both JSON and multipart)
    const contentType = request.headers.get("content-type") || "";
    let completedAt: string;
    let notes: string | undefined;
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      completedAt = formData.get("completed_at") as string;
      notes = (formData.get("notes") as string) || undefined;
      files = formData.getAll("files") as File[];
    } else {
      const body = await request.json();
      completedAt = body.completed_at;
      notes = body.notes;
    }

    const parsed = completeCheckupSchema.safeParse({ completed_at: completedAt, notes });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    if (new Date(parsed.data.completed_at) > new Date()) {
      return NextResponse.json({ error: "No se puede registrar una fecha futura" }, { status: 400 });
    }

    // Validate files if present
    if (files.length > 0) {
      const fileError = attachmentsService.validateFiles(files);
      if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
    }

    const result = await checkupsService.completeCheckup(
      checkupId,
      parsed.data.completed_at,
      user.id,
      parsed.data.notes
    );

    // Upload files if present (parsing happens async in background)
    let attachments: { id: number; cloudinary_url: string; original_filename: string }[] = [];
    if (files.length > 0) {
      attachments = await attachmentsService.uploadAndAttach(result.id, files, user.id);
    }

    return NextResponse.json({ ok: true, id: result.id, attachments });
  } catch (error) {
    console.error("POST /api/checkups/[id]/complete error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

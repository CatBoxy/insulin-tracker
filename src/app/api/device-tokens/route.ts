import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { resolvePatientId } from "@/lib/patient-resolve";
import { deviceTokenSchema } from "@/lib/validation";
import * as deviceTokensService from "@/services/device-tokens.service";
import { registerToken } from "@/services/messaging/push-token";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const parsed = deviceTokenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await deviceTokensService.register(user.id, parsed.data.token, parsed.data.platform);

    // Also register in patient_channels for the messaging engine
    const patientId = await resolvePatientId(user.id);
    if (patientId) {
      await registerToken(patientId, parsed.data.token, parsed.data.platform);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Device token POST error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    await deviceTokensService.unregister(user.id, token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Device token DELETE error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

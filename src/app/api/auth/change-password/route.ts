import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { changePasswordSchema } from "@/lib/validation";
import * as accountService from "@/services/account.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const success = await accountService.changePassword(user.id, parsed.data.current_password, parsed.data.new_password);
    if (!success) {
      return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

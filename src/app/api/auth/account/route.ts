import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-middleware";
import { updateAccountSchema } from "@/lib/validation";
import * as accountService from "@/services/account.service";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const account = await accountService.getAccount(user.id);
    return NextResponse.json({ account });
  } catch (error) {
    console.error("GET /api/auth/account error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await accountService.updateAccount(user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/auth/account error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener mínimo 6 caracteres" },
        { status: 400 }
      );
    }

    const email = String(token.email).toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hash },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("CHANGE PASSWORD ERROR:", e);
    return NextResponse.json(
      { error: "Error interno", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

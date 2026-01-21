export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const token = await getToken({
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.sub) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = String((body as any)?.currentPassword || "");
  const newPassword = String((body as any)?.newPassword || "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "La nueva contraseña debe tener mínimo 6 caracteres" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: String(token.sub) },
    select: { id: true, password: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no existe" }, { status: 404 });
  }

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) {
    return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash },
  });

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  const token = String(body?.token || "").trim();
  const newPassword = String(body?.newPassword || "");

  if (!email || !token || !newPassword) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Contraseña muy corta (mín 6)." }, { status: 400 });
  }

  const tokenHash = sha256(token);

  const row = await prisma.passwordReset.findFirst({
    where: { email, tokenHash },
    select: { id: true, expiresAt: true },
  });

  if (!row) {
    return NextResponse.json({ error: "Token inválido." }, { status: 400 });
  }

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "Token expirado." }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { email },
    data: { password: hash },
  });

  await prisma.passwordReset.deleteMany({ where: { email } });

  return NextResponse.json({ ok: true });
}

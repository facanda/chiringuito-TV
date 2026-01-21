export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

function validatePassword(pw: string) {
  if (!pw || pw.length < 6) return "Mínimo 6 caracteres.";
  return null;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  const userId = String(ctx?.params?.id || "");
  const body = await req.json().catch(() => ({} as any));
  const newPassword = String(body?.newPassword || "");

  const err = validatePassword(newPassword);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const hash = await bcrypt.hash(newPassword, 10);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      password: hash,
      sessionVersion: { increment: 1 }, // kick inmediato
    },
    select: { id: true, email: true },
  });

  await prisma.loginSession.deleteMany({ where: { userId } });

  return NextResponse.json({ ok: true, user: updated });
}

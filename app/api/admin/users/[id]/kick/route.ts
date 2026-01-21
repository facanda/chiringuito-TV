export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  const userId = String(ctx?.params?.id || "");

  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });

  await prisma.loginSession.deleteMany({ where: { userId } });

  return NextResponse.json({ ok: true });
}

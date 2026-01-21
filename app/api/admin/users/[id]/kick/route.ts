export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((token as any).role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;

  await prisma.user.update({
    where: { id },
    data: { sessionVersion: { increment: 1 } },
  });

  await prisma.loginSession.deleteMany({ where: { userId: id } });

  await auditLog({
    actorId: token.sub as string,
    actorEmail: (token as any).email || null,
    action: "USER_KICK",
    targetId: id,
    target: null,
    meta: {},
    req,
  });

  return NextResponse.json({ ok: true });
}
